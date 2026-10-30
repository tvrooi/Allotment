import fs from 'fs';
import { test, expect, type Page } from '@playwright/test';

// Multi-user mode (docs/MULTI-USER-PLAN.md): the gateway signs people in by name, and each
// person's budget is its own server process. The administrator adds a person with an
// invitation code; neither can see the other's budget. Made-up people and budgets only.

test.describe.configure({ mode: 'serial' });

const OWNER = 'correct horse battery';
const PARTNER = 'partner passphrase';

let owner: Page;
let partner: Page;
let invitation = '';

/** The latest code printed in the gateway's log (setup, or a password reset) */
function lastCode(after: RegExp) {
  const log = fs.readFileSync(process.env.E2E_MULTI_USER_LOG!, 'utf8');
  const lines = log.split('\n').filter((l) => after.test(l) || /^\s+[A-Z2-9]{4}-/.test(l));
  const codes = lines.join('\n').match(/[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}/g);
  if (!codes) throw new Error(`No code in the gateway log:\n${log}`);
  return codes.at(-1)!;
}

test.beforeAll(async ({ browser }) => {
  owner = await (await browser.newContext()).newPage();
  partner = await (await browser.newContext()).newPage();
});
test.afterAll(async () => {
  await owner.context().close();
  await partner.context().close();
});

test('the first person sets up with a name and keeps the budget already there', async ({
  baseURL,
}) => {
  await owner.goto(`${baseURL}/`);
  await expect(owner.getByText('Set up your Allotment server')).toBeVisible();
  await expect(owner.getByText(/You become the administrator/)).toBeVisible();
  await owner.getByLabel('Your name').fill('Tristan');
  await owner.getByLabel('Setup code').fill(lastCode(/setup code/i));
  await owner.getByLabel('New password').fill(OWNER);
  await owner.getByLabel('Confirm password').fill(OWNER);
  await owner.getByRole('button', { name: 'Create password' }).click();
  await expect(owner.getByRole('heading', { name: 'Welcome to Allotment' })).toBeVisible();
  const made = await owner.request.post('/api/accounts', {
    data: { name: 'Owner everyday', type: 'checking', startingBalance: 50_000 },
  });
  expect(made.status()).toBe(201);
});

test('the administrator adds a person, who gets an invitation code', async () => {
  // Straight after signing in, without reloading: the app knows who signed in
  await owner.getByRole('button', { name: /^Skip for now/ }).click();
  await owner.getByRole('link', { name: 'Settings' }).first().click();
  await owner.getByRole('button', { name: 'Server', exact: true }).click();
  const people = owner.getByRole('list', { name: 'People' });
  await expect(people).toContainText('Tristan');
  await expect(people).toContainText('administrator');
  await owner.getByLabel("New person's name").fill('Edward');
  await owner.getByRole('button', { name: 'Add person' }).click();
  const status = owner.getByRole('status').filter({ hasText: 'invitation code' });
  await expect(status).toContainText('Edward has a budget of their own', { timeout: 60_000 });
  invitation = (await status.textContent())!.match(/[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}/)![0];
  await expect(people).toContainText('invited');
});

test('the invited person signs up and sees only their own, empty budget', async ({ baseURL }) => {
  await partner.goto(`${baseURL}/`);
  await expect(partner.getByText('Sign in to Allotment')).toBeVisible();
  await partner.getByRole('button', { name: 'I have an invitation' }).click();
  await partner.getByLabel('Name').fill('edward');
  await partner.getByLabel('Invitation code').fill(invitation.toLowerCase());
  await partner.getByLabel('New password').fill(PARTNER);
  await partner.getByLabel('Confirm password').fill(PARTNER);
  await partner.getByRole('button', { name: 'Set password and sign in' }).click();
  await expect(partner.getByRole('heading', { name: 'Welcome to Allotment' })).toBeVisible();
  const accounts = await partner.request.get('/api/accounts');
  expect(await accounts.json()).toEqual([]);
  const made = await partner.request.post('/api/accounts', {
    data: { name: 'Edward savings', type: 'savings', startingBalance: 1_000 },
  });
  expect(made.status()).toBe(201);
  // People are the administrator's to manage
  expect((await partner.request.get('/api/people')).status()).toBe(403);
  // A new budget opens on the welcome page until it's set up or skipped
  await partner.getByRole('button', { name: 'Skip for now' }).click();
  await partner.goto('/settings?tab=server');
  await expect(partner.getByRole('heading', { name: 'Change password' })).toBeVisible();
  await expect(partner.getByRole('list', { name: 'People' })).toBeHidden();
  // The owner's budget is unchanged and still theirs alone
  const ownerAccounts = await owner.request.get('/api/accounts');
  expect((await ownerAccounts.json()).map((a: { name: string }) => a.name)).toEqual([
    'Owner everyday',
  ]);
});

test("two people combine their households and see each other's entries", async () => {
  // Each keeps a household in their own budget, with one entry
  const home = await (
    await owner.request.post('/api/households', {
      data: { name: 'Home', currency: 'AUD', people: ['Tristan', 'Edward', 'Sam'], selfIndex: 0 },
    })
  ).json();
  const [me, ed, sam] = home.people;
  await owner.request.post(`/api/households/${home.group.id}/events`, {
    data: {
      kind: 'expense',
      date: '2026-10-01',
      description: 'Groceries',
      amount: 9_000,
      payerId: me.id,
      mode: 'weight',
      shares: [me, ed, sam].map((p: { id: string }) => ({ personId: p.id, value: 1 })),
    },
  });
  const ours = await (
    await partner.request.post('/api/households', {
      data: { name: 'Our place', currency: 'AUD', people: ['Edward', 'Tristan'], selfIndex: 0 },
    })
  ).json();
  const [edSelf, edTristan] = ours.people;
  await partner.request.post(`/api/households/${ours.group.id}/events`, {
    data: {
      kind: 'expense',
      date: '2026-10-02',
      description: 'Electricity',
      amount: 20_000,
      payerId: edSelf.id,
      mode: 'weight',
      shares: [edSelf, edTristan].map((p: { id: string }) => ({ personId: p.id, value: 1 })),
    },
  });

  // Tristan asks, naming who Edward is in his household
  await owner.goto('/household');
  const ask = owner.getByRole('region', { name: 'Combine with another Allotment user' });
  await ask.getByLabel('Combine with').selectOption({ label: 'Edward' });
  await ask.getByLabel('Who they are in this household').selectOption({ label: 'Edward' });
  await ask.getByRole('button', { name: 'Ask to combine' }).click();
  await expect(ask.getByText('Waiting for Edward to accept.')).toBeVisible();

  // Edward accepts with his own household
  await partner.goto('/household');
  const accept = partner.getByRole('region', { name: 'Combine with another Allotment user' });
  await expect(accept.getByText('Tristan asked to combine')).toBeVisible();
  await accept.getByLabel('Who Tristan is in Our place').selectOption({ label: 'Tristan' });
  await accept.getByRole('button', { name: 'Combine with Our place' }).click();
  await expect(accept.getByText('Combined with Tristan.')).toBeVisible();

  // He sees Tristan's entry, its split and the combined balances
  await accept.getByRole('button', { name: /Groceries/ }).click();
  await expect(accept.getByText("Tristan's", { exact: false }).first()).toBeVisible();
  const split = accept.getByRole('table', { name: 'Split' });
  await expect(split).toContainText('Sam');
  await expect(split).toContainText('$30');
  // His own new budget has no currency yet, so AUD shows as A$
  await expect(accept.getByRole('listitem').filter({ hasText: 'Sam' }).first()).toContainText(
    /-A?\$30/,
  );
  await accept.screenshot({ path: test.info().outputPath('combined-household.png') });
  // Nothing else from Tristan's budget
  expect(await accept.innerText()).not.toContain('Owner everyday');

  // A note either can edit
  await accept.getByLabel('Shared note').fill('Dinner with Sam');
  await accept.getByRole('button', { name: 'Save note' }).click();
  await expect(accept.getByText('Last changed by Edward')).toBeVisible();
  await owner.reload();
  await ask.getByRole('button', { name: /Groceries/ }).click();
  await expect(ask.getByLabel('Shared note')).toHaveValue('Dinner with Sam');
  await ask.getByLabel('Shared note').fill('Dinner with Sam and friends');
  await ask.getByRole('button', { name: 'Save note' }).click();
  await expect(ask.getByText('Last changed by Tristan')).toBeVisible();

  // Either can stop, and then neither sees the other's entries
  await ask.getByRole('button', { name: 'Stop combining' }).click();
  await owner.getByRole('dialog').getByRole('button', { name: 'Stop combining' }).click();
  await expect(ask.getByRole('button', { name: 'Ask to combine' })).toBeVisible();
  await partner.reload();
  await expect(accept.getByText('Combined with Tristan.')).toBeHidden();
  await expect(accept.getByRole('button', { name: /Groceries/ })).toHaveCount(0);
});

test('signing in needs the right name for the password', async ({ browser, baseURL }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${baseURL}/`);
  await page.getByLabel('Name').fill('Tristan');
  await page.getByLabel('Password', { exact: true }).fill(PARTNER);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect name or password')).toBeVisible();
  await page.context().close();
});

test("the administrator's forgotten password is reset with a code from the log", async ({
  browser,
  baseURL,
}) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${baseURL}/`);
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Name').fill('Tristan');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await expect(page.getByRole('status')).toContainText('If that person can receive codes');
  await expect(page.getByText('Choose a new password')).toBeVisible();
  await expect.poll(() => lastCode(/Password reset code for Tristan/)).toBeTruthy();
  await page.getByLabel('Code', { exact: true }).fill(lastCode(/Password reset code for Tristan/));
  await page.getByLabel('New password').fill('a brand new phrase');
  await page.getByLabel('Confirm password').fill('a brand new phrase');
  await page.getByRole('button', { name: 'Set password and sign in' }).click();
  await expect(page.getByRole('navigation').first()).toBeVisible();
  expect(
    (await (await page.request.get('/api/accounts')).json()).map((a: { name: string }) => a.name),
  ).toEqual(['Owner everyday']);
  // The old password's other session was signed out
  expect((await owner.request.get('/api/accounts')).status()).toBe(401);
  await page.context().close();
});

test("another person signing in on the same browser takes over every tab's budget", async ({
  baseURL,
}) => {
  // Edward's budget in one tab...
  await partner.goto(`${baseURL}/accounts`);
  await expect(partner.getByText('Edward savings').first()).toBeVisible();
  // ...while a second tab signs out and Tristan signs in there (tabs share the session)
  const other = await partner.context().newPage();
  await partner.evaluate(
    () => ((window as unknown as { edwardWasHere: boolean }).edwardWasHere = true),
  );
  await other.request.post('/api/auth/logout');
  await other.goto(`${baseURL}/`);
  await expect(partner.getByText('Sign in to Allotment')).toBeVisible();
  // The page started again: nothing of Edward's stays in its memory (undo history, toasts...)
  await partner.waitForLoadState();
  expect(await partner.evaluate(() => 'edwardWasHere' in window)).toBe(false);
  await other.getByLabel('Name').fill('Tristan');
  await other.getByLabel('Password', { exact: true }).fill('a brand new phrase');
  await other.getByRole('button', { name: 'Sign in' }).click();
  await expect(other.getByRole('navigation').first()).toBeVisible();
  // The first tab follows: Tristan's budget, nothing of Edward's left on screen
  await partner.goto(`${baseURL}/accounts`);
  await expect(partner.getByText('Owner everyday').first()).toBeVisible();
  await expect(partner.getByText('Edward savings')).toHaveCount(0);
  await other.close();
});
