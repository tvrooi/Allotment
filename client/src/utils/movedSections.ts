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

/** The old name of the Connected banks link, kept until each link site uses connectedBanksLink */
export const CONNECTED_BANKS_LINK = CONNECTED_BANKS_PATH;

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
