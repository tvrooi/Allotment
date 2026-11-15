// Where the sections that left Settings live now (#244). Every link to them, the routes, and
// Settings' redirect from the old ?tab= addresses use these.

/** Connected banks, its own page under Accounts */
export const CONNECTED_BANKS_PATH = '/accounts/connections';

/** The banks the Connected banks page can open, in the order its provider toggle shows them */
export const BANK_PROVIDERS = ['up', 'plaid', 'simplefin', 'enablebanking'] as const;

export type BankProvider = (typeof BANK_PROVIDERS)[number];

/** A ?provider= value when it names one of the banks exactly, otherwise null */
export function parseProvider(value: string | null): BankProvider | null {
  return BANK_PROVIDERS.find((p) => p === value) ?? null;
}

/** The Connected banks page, opened on a provider when one is given */
export function connectedBanksLink(provider?: BankProvider): string {
  return provider ? `${CONNECTED_BANKS_PATH}?provider=${provider}` : CONNECTED_BANKS_PATH;
}

/**
 * The bank feeds' display labels and the provider each opens. The labels are written in
 * components/dashboard/StatusStrip.tsx and components/up/UpSyncBadge.tsx: add a new bank there
 * and here together.
 */
const FEED_PROVIDERS: Readonly<Record<string, BankProvider>> = {
  Up: 'up',
  Plaid: 'plaid',
  SimpleFIN: 'simplefin',
  'Enable Banking': 'enablebanking',
};

/** Connected banks opened on a bank feed's own provider, or plainly for a label it does not know */
export function bankFeedLink(feedLabel: string): string {
  return connectedBanksLink(
    Object.hasOwn(FEED_PROVIDERS, feedLabel) ? FEED_PROVIDERS[feedLabel] : undefined,
  );
}

/** The category manager, a view of the Budget page */
export const MANAGE_CATEGORIES_LINK = '/budget?view=categories';

/** The old Settings tabs and where each went */
const MOVED_SETTINGS_TABS: Readonly<Record<string, string>> = {
  connections: CONNECTED_BANKS_PATH,
  categories: MANAGE_CATEGORIES_LINK,
};

/** Where a Settings ?tab= value now lives, or null when it is still a Settings tab */
export function movedSettingsTab(tab: string | null): string | null {
  return tab && Object.hasOwn(MOVED_SETTINGS_TABS, tab) ? MOVED_SETTINGS_TABS[tab] : null;
}
