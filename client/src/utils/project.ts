/**
 * Where Allotment's source code lives, linked from Settings. Allotment is AGPL-3.0:
 * if you run a modified version for other people over a network, point this at your
 * own source code so your users can get it (AGPL-3.0, section 13).
 */
export const SOURCE_CODE_URL = 'https://github.com/tvrooi/Allotment';
export const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';

/**
 * The upstream FlyBudget website, which Allotment is built on. Allotment's own guide is served
 * by the app at /guide (client/src/userGuide); only a few detailed setup pages link upstream.
 */
export const WEBSITE_URL = 'https://flybudget.org';

/** Where people report bugs and ask for features */
export const ISSUES_URL = 'https://github.com/tvrooi/Allotment/issues';

/** How to run Allotment on your own server (linked from Settings → Server) */
export const SELF_HOSTING_URL = `${WEBSITE_URL}/community/self-hosting`;

/** A page of Allotment's guide (/guide/<page>), e.g. `<GuideLink page="budgeting">` */
export type DocsPage =
  | 'getting-started'
  | 'accounts'
  | 'transactions'
  | 'bank-sync'
  | 'budgeting'
  | 'recurring'
  | 'reports'
  | 'rules'
  | 'goals'
  | 'tax'
  | 'currencies'
  | 'backups';

/** The same topic in the upstream FlyBudget guide, for setup details Allotment's guide skips */
export const upstreamDocsUrl = (page: DocsPage) => `${WEBSITE_URL}/docs/${page}`;
