/**
 * Where Allotment's source code lives, linked from Settings. Allotment is AGPL-3.0:
 * if you run a modified version for other people over a network, point this at your
 * own source code so your users can get it (AGPL-3.0, section 13).
 */
export const SOURCE_CODE_URL = 'https://github.com/tvrooi/Allotment';
export const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';

/** Where people report bugs and ask for features */
export const ISSUES_URL = 'https://github.com/tvrooi/Allotment/issues';

/**
 * How to run Allotment on your own server (linked from Settings → Server): this fork's own
 * Start here guide. The upstream site's self-hosting page uses different image and data names.
 */
export const SELF_HOSTING_URL = `${SOURCE_CODE_URL}/blob/main/docs/START-HERE.md`;

/** The pages of Allotment's guide (/guide/<page>); each has one article in `userGuide/articles.tsx` */
export const DOCS_PAGES = [
  'getting-started',
  'accounts',
  'transactions',
  'bank-sync',
  'enable-banking',
  'budgeting',
  'move-money',
  'payday-plans',
  'card-payments',
  'recurring',
  'review',
  'reports',
  'rules',
  'goals',
  'long-term-forecast',
  'tax',
  'currencies',
  'households',
  'backups',
] as const;

/** A page of Allotment's guide (/guide/<page>), e.g. `<GuideLink page="budgeting">` */
export type DocsPage = (typeof DOCS_PAGES)[number];
