// Where the sections that left Settings live now (#244). Every link to them, and Settings'
// redirect from the old ?tab= addresses, uses these.

/** Connected banks, on the Accounts page, opened on Up */
export const CONNECTED_BANKS_LINK = '/accounts?banks=up';

/** The category manager, a view of the Budget page */
export const MANAGE_CATEGORIES_LINK = '/budget?view=categories';

/** The old Settings tabs and where each went */
const MOVED_SETTINGS_TABS: Readonly<Record<string, string>> = {
  connections: CONNECTED_BANKS_LINK,
  categories: MANAGE_CATEGORIES_LINK,
};

/** Where a Settings ?tab= value now lives, or null when it is still a Settings tab */
export function movedSettingsTab(tab: string | null): string | null {
  return tab && Object.hasOwn(MOVED_SETTINGS_TABS, tab) ? MOVED_SETTINGS_TABS[tab] : null;
}
