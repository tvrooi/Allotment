/**
 * One sentence per page: what it's for, shown above the page on a first visit (with the page's
 * guide when it has one). Pages without a guide record the intro as seen under its id, in the
 * same progress as guides; never rename an id.
 */
export const PAGE_INTROS: Record<string, { id: string; text: string }> = {
  '/dashboard': {
    id: 'intro.dashboard',
    text: 'Your home page: what’s left to spend, what’s due, and how the month is going.',
  },
  '/accounts': {
    id: 'intro.accounts',
    text: 'Every account you track, from Up to super, and what they add up to.',
  },
  '/transactions': {
    id: 'intro.transactions',
    text: 'Every transaction in one list. Give each a category so it comes out of the right envelope.',
  },
  '/budget': {
    id: 'intro.budget',
    text: 'Where you give every dollar a job: assign money to envelopes until Ready to assign is $0.',
  },
  '/review': {
    id: 'intro.review',
    text: 'A check-up: what needs fixing, most urgent first. Nothing changes until you act.',
  },
  '/recurring': {
    id: 'intro.recurring',
    text: 'Bills and pay that repeat, so you can see what’s coming before it arrives.',
  },
  '/payment-plans': {
    id: 'intro.payment-plans',
    text: 'Pay later: Afterpay and Zip purchases, in their real category, with what’s still owed.',
  },
  '/household': {
    id: 'intro.household',
    text: 'Split costs with people you live with and keep track of who owes whom.',
  },
  '/reports': {
    id: 'intro.reports',
    text: 'Charts of where your money goes, over any period you choose.',
  },
  '/cash-flow': {
    id: 'intro.cash-flow',
    text: 'Money in, flowing into what you spent it on, and what was left over.',
  },
  '/goals': {
    id: 'intro.goals',
    text: 'Save towards something, and see what to put aside to get there in time.',
  },
  '/forecast': {
    id: 'intro.forecast',
    text: 'Where your cash is heading: until payday, and over the years.',
  },
  '/investments': {
    id: 'intro.investments',
    text: 'What your shares and super hold, and what they’re worth.',
  },
  '/tax': {
    id: 'intro.tax',
    text: 'Tax time: your deductions and the receipts behind them, ready for your return.',
  },
  '/files': {
    id: 'intro.files',
    text: 'Documents that belong with your money: bills, warranties, policies.',
  },
  '/payees': {
    id: 'intro.payees',
    text: 'Everyone you pay or get paid by, with the category each one usually goes in.',
  },
  '/rules': {
    id: 'intro.rules',
    text: 'Rules sort new transactions for you: rename them, categorise them or split them.',
  },
};
