import { gunzipSync } from 'zlib';
import {
  test as base,
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';

// Fixtures for the desktop-app suite.
//
// - Every test starts from the fresh database snapshot taken in global-setup.ts
//   (restored through the app's own backup restore), so tests don't affect each other.
// - Pages are set up like the Electron window: the preload's __API_BASE__ (which also
//   switches the app to hash routing) and the per-launch API token cookie.
// - `api` seeds data through the HTTP API with the same token.
// - A test fails if the page throws or logs a console error.

const token = () => process.env.E2E_API_TOKEN!;

export type Account = { id: string; name: string; balance: number; startingBalance: number };
export type Category = {
  id: string;
  name: string;
  groupId: string;
  icon: string | null;
  keepOverspending?: number;
};
export type CategoryGroup = { id: string; name: string; isIncome: number; categories: Category[] };

export class Api {
  constructor(readonly request: APIRequestContext) {}

  async call<T = any>(method: string, path: string, data?: unknown): Promise<T> {
    const res = await this.request.fetch(`/api${path}`, { method, data });
    if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()}: ${await res.text()}`);
    return (res.status() === 204 ? null : await res.json()) as T;
  }

  createAccount(name: string, startingBalance = 0, type = 'checking', extra: object = {}) {
    return this.call<Account>('POST', '/accounts', { name, type, startingBalance, ...extra });
  }

  createTransaction(data: {
    accountId: string;
    date: string;
    amount: number;
    payeeName?: string;
    categoryId?: string | null;
    notes?: string;
    splits?: { categoryId: string | null; amount: number }[];
  }) {
    return this.call('POST', '/transactions', data);
  }

  async accounts() {
    return this.call<Account[]>('GET', '/accounts');
  }

  async balance(accountId: string) {
    return (await this.accounts()).find((a) => a.id === accountId)!.balance;
  }

  async categoryGroups() {
    return this.call<CategoryGroup[]>('GET', '/categories');
  }

  /** A category from the default set, by name */
  async category(name: string) {
    for (const g of await this.categoryGroups()) {
      const c = g.categories.find((c) => c.name === name);
      if (c) return c;
    }
    throw new Error(`No category named ${name}`);
  }

  /** The ledger: both sides of every transfer, not the register's folded pairs */
  transactions(query = '') {
    const all = `${query ? `${query}&` : '?'}transfer_pairs=show`;
    return this.call<any[]>('GET', `/transactions${all}`);
  }
}

/** Opens an app route (hash routing, like the desktop app) */
export async function open(page: Page, route: string) {
  await page.goto(`/#${route}`);
}

/** The fresh database, as a backup (from global-setup.ts) */
let fresh: unknown;
const freshSnapshot = () =>
  (fresh ??= JSON.parse(gunzipSync(Buffer.from(process.env.E2E_SNAPSHOT!, 'base64')).toString()));

type Fixtures = { api: Api; resetDatabase: void; consoleGuard: void };

export const test = base.extend<Fixtures>({
  resetDatabase: [
    async ({ playwright, baseURL }, use) => {
      const request = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { cookie: `flybudget_token=${token()}` },
      });
      const res = await request.post('/api/export/restore', {
        data: freshSnapshot(),
      });
      if (!res.ok()) throw new Error(`Database reset failed: ${await res.text()}`);
      // Guide progress isn't in backups, so the restore leaves whatever the last test did
      // (a dashboard visit can turn down the welcome tour). Start each test as a new budget.
      const guideProgress = await request.get('/api/guides');
      if (!guideProgress.ok()) throw new Error('Could not read guide choices for reset');
      const choices: Record<string, string> = (await guideProgress.json()).navFeatures ?? {};
      for (const [method, path, data] of [
        ['POST', '/api/guides/reset', undefined],
        [
          'PUT',
          '/api/guides',
          {
            tipsEnabled: true,
            pageGuidesEnabled: true,
            navFeatures: Object.fromEntries(Object.keys(choices).map((key) => [key, 'auto'])),
          },
        ],
      ] as const) {
        const guides = await request.fetch(path, { method, data });
        if (!guides.ok()) throw new Error(`Guide reset failed: ${await guides.text()}`);
      }
      await request.dispose();
      await use();
    },
    { auto: true },
  ],

  context: async ({ context, baseURL }, use) => {
    await context.addInitScript((apiBase) => {
      (window as unknown as { __API_BASE__: string }).__API_BASE__ = apiBase;
    }, `${baseURL}/api`);
    await context.addCookies([
      {
        name: 'flybudget_token',
        value: token(),
        url: baseURL!,
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);
    await use(context);
  },

  api: async ({ playwright, baseURL }, use) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { cookie: `flybudget_token=${token()}` },
    });
    await use(new Api(request));
    await request.dispose();
  },

  consoleGuard: [
    async ({ page }, use, testInfo) => {
      const problems: string[] = [];
      page.on('pageerror', (err) => problems.push(`Uncaught: ${err.message}`));
      page.on('console', (msg) => {
        // Failed requests are reported by the request itself; tests assert on those
        if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) {
          problems.push(`console.error: ${msg.text()}`);
        }
      });
      await use();
      // Tests that provoke errors on purpose (e.g. a CSP violation) opt out with
      // test.info().annotations.push({ type: 'allow-page-errors' })
      const allowed = testInfo.annotations.some((a) => a.type === 'allow-page-errors');
      if (!allowed && testInfo.status === testInfo.expectedStatus) {
        expect(problems, 'the page logged errors').toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };

/** A theme token's computed colour (`rgb(...)`), read from a temporary element in the page */
export const tokenColour = (
  page: Page,
  name: string,
  property: 'backgroundColor' | 'color' = 'backgroundColor',
) =>
  page.evaluate(
    ({ token, prop }) => {
      const probe = document.createElement('span');
      probe.style[prop] = `var(${token})`;
      document.body.append(probe);
      const colour = getComputedStyle(probe)[prop];
      probe.remove();
      return colour;
    },
    { token: name, prop: property },
  );

/** Today and nearby days as yyyy-MM-dd, in the browser's time zone setting */
export function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const thisMonth = () => isoDay().slice(0, 7);

/** A day other than today in this month (registers open on This Month): yesterday, or tomorrow on the 1st */
export const otherDayThisMonth = () =>
  isoDay(-1).slice(0, 7) === thisMonth() ? isoDay(-1) : isoDay(1);

/**
 * Types into an amount field the way a person does: click it (which selects the current
 * amount) and type over it. `fill()` doesn't work here: the field switches from "$1,234"
 * to a plain number while focused.
 */
export async function typeAmount(field: Locator, amount: string) {
  const page = field.page();
  await field.click();
  // Once focused it shows the plain amount for editing, so type through the keyboard
  await expect(field).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(amount);
  await page.keyboard.press('Tab');
}

/**
 * The one way specs choose from the shared Select (client/src/components/ui/Select.tsx), at any
 * width. `field` is the Select's control: its native select on phones, its trigger button on
 * desktop. A native select picks the option by its label; the trigger opens the listbox and
 * clicks the option with exactly that name. A desktop spec moving off `selectOption` (D-05)
 * changes this call, not its logic.
 */
export async function chooseOption(field: Locator, name: string) {
  if (await field.evaluate((el) => el.tagName === 'SELECT')) {
    await field.selectOption({ label: name });
    return;
  }
  await field.click();
  const page = field.page();
  const option = page.getByRole('option', { name, exact: true });
  const list = page.getByRole('listbox').filter({ has: option });
  await list.getByRole('option', { name, exact: true }).click();
  await expect(list).toHaveCount(0);
}

/**
 * The one way specs locate a row of the category picker's list
 * (client/src/components/transactions/CategoryPicker.tsx): the no-category row, a category, or a
 * "Transfer: name" row, in `scope` (the page, or a dialog or panel holding the picker). The
 * picker is the shared searchable list (SearchList), so every row, the no-category row
 * included, is a listbox option. It needs no `api`, so the demo spec can use it.
 */
export function categoryOption(
  scope: Page | Locator,
  name: string | RegExp,
  options: { exact?: boolean } = {},
) {
  return scope.getByRole('option', { name, exact: options.exact });
}

/**
 * The label a person clicks or taps to toggle a shared Checkbox, Radio or Switch
 * (client/src/components/ui/Checkbox.tsx, RadioGroup.tsx, Switch.tsx). React Aria hides the 1 px
 * native input inside its wrapping label, so the label takes the click and is the 44 px phone
 * target.
 */
export const toggleTarget = (control: Locator) => control.locator('xpath=ancestor::label[1]');

/**
 * The one way specs check or uncheck a shared Checkbox, Radio or Switch: clicks its wrapping label
 * when its checked state differs from `checked` (avoiding pointer interception on React Aria's
 * hidden 1 px input) and asserts the resulting state.
 */
export async function setToggle(control: Locator, checked = true) {
  const target = toggleTarget(control);
  await expect(target).toBeVisible();
  if ((await control.isChecked()) !== checked) {
    await target.click();
  }
  if (checked) await expect(control).toBeChecked();
  else await expect(control).not.toBeChecked();
}

/** A date or month field's scope: the page, or a dialog, form or row holding the field */
type Scope = Page | Locator;

/**
 * The native `<input type>` in `scope` whose accessible name is `name`, or null. The name is
 * its aria-label, else its label's text without aria-hidden parts (a required mark), the way a
 * screen reader reads it; getByLabel would keep the mark. React Aria's own hidden inputs have no
 * label, so they never match.
 */
async function nativeField(scope: Scope, type: 'date' | 'month', name: string) {
  const inputs = scope.locator(`input[type="${type}"]`);
  const index = await inputs.evaluateAll(
    (els, wanted) =>
      els.findIndex((el) => {
        const own = el.getAttribute('aria-label');
        if (own !== null) return own.trim() === wanted;
        const label = (el as HTMLInputElement).labels?.[0];
        if (!label) return false;
        const copy = label.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('[aria-hidden="true"], input').forEach((part) => part.remove());
        return copy.textContent?.trim() === wanted;
      }),
    name,
  );
  return index < 0 ? null : inputs.nth(index);
}

/**
 * The one way specs enter a date (D-07), into the shared DatePicker
 * (client/src/components/ui/DatePicker.tsx) at any width, and into the native date fields that
 * have not moved onto it yet. `name` is the field's accessible name and `iso` a YYYY-MM-DD day.
 * A native date input (a phone's DatePicker, or an older field) is filled with the day as it is.
 * Otherwise it finds the date group by role and name and types the year, then the month, then
 * the day into the segments marked with those `data-type`s, so it works in every Date format
 * preference's segment order (the day last, so a short month never clips it).
 */
export async function fillDate(scope: Scope, name: string, iso: string) {
  const native = await nativeField(scope, 'date', name);
  if (native) {
    await native.fill(iso);
    return;
  }
  const [year, month, day] = iso.split('-');
  const group = scope.getByRole('group', { name, exact: true });
  for (const [type, digits] of [
    ['year', year],
    ['month', month],
    ['day', day],
  ] as const) {
    const segment = group.locator(`[data-type="${type}"]`);
    await segment.click();
    await expect(segment).toBeFocused();
    await segment.page().keyboard.type(digits);
  }
}

/** A literal regular expression matching `text` */
const literally = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The one way specs enter a month, the counterpart of fillDate, into the shared MonthPicker
 * (client/src/components/ui/MonthPicker.tsx) at any width and the native month fields that have
 * not moved onto it. `name` is the field's label and `month` a YYYY-MM month. A native month
 * input is filled as it is. Otherwise it opens the trigger (named by the label, then the shown
 * month), steps the year to the month's, and presses the button named by the full month and
 * year, which closes the grid.
 */
export async function fillMonth(scope: Scope, name: string, month: string) {
  const native = await nativeField(scope, 'month', name);
  if (native) {
    await native.fill(month);
    return;
  }
  const [year, number] = month.split('-').map(Number);
  const page = 'page' in scope ? scope.page() : scope;
  await scope.getByRole('button', { name: new RegExp(`^${literally(name)} `) }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose a month' });
  await expect(dialog).toBeVisible();
  const monthName = new Date(Date.UTC(year, number - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
  // The shown year is the year in the grid's month names ("January 2026")
  for (let step = 0; step < 100; step++) {
    const first = await dialog.locator('button[aria-pressed]').first().getAttribute('aria-label');
    const shown = Number(first?.split(' ')[1]);
    if (shown === year) break;
    await dialog
      .getByRole('button', { name: shown < year ? 'Next year' : 'Previous year' })
      .click();
  }
  await dialog.getByRole('button', { name: `${monthName} ${year}`, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
