import type { Guide } from './types';

// One short guide per page, offered the first time the page is opened (once the welcome tour
// is decided) and kept under "Guide for this page" in the ? menu. Only describe what the page
// really does: check it before changing a step.

export const accountsGuide: Guide = {
  id: 'accounts',
  version: 1,
  title: 'Accounts',
  summary: 'Adding accounts, net worth, and opening an account to import or reconcile.',
  page: '/accounts',
  steps: [
    {
      title: 'Add your accounts',
      body: 'Add every account you want to track: everyday and savings accounts, credit cards, loans, investments or your home. Each keeps its own balance and transactions.',
      route: '/accounts',
      target: 'accounts.add',
    },
    {
      title: 'Net worth',
      body: 'What you own minus what you owe, across every account, and how it has changed.',
      route: '/accounts',
      target: 'accounts.summary',
    },
    {
      title: 'Open an account',
      body: 'Select an account to see its transactions, import a CSV file from your bank, or reconcile it against your statement so its balance matches the bank.',
      route: '/accounts',
      target: 'accounts.list',
    },
    {
      title: 'Bring in transactions automatically',
      body: 'Connect Up under Settings → Connected Banks and its settled transactions are imported for you.',
      route: '/accounts',
    },
  ],
};

export const transactionsGuide: Guide = {
  id: 'transactions',
  version: 1,
  title: 'Transactions',
  summary: 'Finding transactions, changing them, rules from a transaction, and receipts.',
  page: '/transactions',
  steps: [
    {
      title: 'Find anything',
      body: 'Search by payee or notes, or filter by account, category, payee, tag, dates and amount.',
      route: '/transactions',
      target: 'transactions.filters',
    },
    {
      title: 'Change a transaction',
      body: 'Select a transaction to change its category, payee or notes, split it across categories, or create a rule from it so the next one is sorted for you.',
      phoneBody:
        'Tap a transaction to change its category, payee or notes, split it across categories, or create a rule from it so the next one is sorted for you.',
      route: '/transactions',
    },
    {
      title: 'Receipts',
      body: 'Keep photos of your receipts here and match each one to its transaction.',
      route: '/transactions',
      target: 'transactions.tabs',
    },
    {
      title: 'Add by hand',
      body: 'Add a transaction that isn’t from a bank, such as cash.',
      route: '/transactions',
      target: 'transactions.add',
    },
  ],
};

export const rulesGuide: Guide = {
  id: 'rules',
  version: 1,
  title: 'Rules',
  summary: 'How rules sort new transactions, adding one, and running rules on what’s there.',
  page: '/rules',
  steps: [
    {
      title: 'Rules do the sorting',
      body: 'Rules run on new and imported transactions, top to bottom. They can set a category, rename a payee or split a transaction.',
      route: '/rules',
      target: 'rules.header',
    },
    {
      title: 'Add a rule',
      body: 'For example: when the payee contains Netflix, set the category to Streaming. You can also create one from any transaction.',
      route: '/rules',
      target: 'rules.add',
    },
    {
      title: 'Run rules',
      body: 'Applies your rules to transactions that aren’t categorised yet.',
      route: '/rules',
      target: 'rules.run',
    },
  ],
};

export const recurringGuide: Guide = {
  id: 'recurring',
  version: 1,
  title: 'Recurring',
  summary: 'This month’s bills and pay, finding them for you, and adding one.',
  page: '/recurring',
  steps: [
    {
      title: 'Bills and pay',
      body: 'Monthly shows what’s due this month; All recurring lists every bill and pay you’ve set up.',
      route: '/recurring',
      target: 'recurring.tabs',
    },
    {
      title: 'Find them for you',
      body: 'Find recurring looks through your transactions for bills and pay that repeat, so you can add them in one go.',
      route: '/recurring',
      target: 'recurring.find',
    },
    {
      title: 'Add one',
      body: 'Add a bill or pay by hand. The Budget page then shows each category’s unpaid bills for the month.',
      route: '/recurring',
      target: 'recurring.add',
    },
  ],
};

export const reviewGuide: Guide = {
  id: 'review',
  version: 1,
  title: 'Review',
  summary: 'What needs attention, and what’s set aside for next month.',
  page: '/review',
  steps: [
    {
      title: 'A read-only check',
      body: 'Review looks over your budget. It only reads: nothing changes until you act.',
      route: '/review',
      target: 'review.header',
    },
    {
      title: 'Needs attention',
      body: 'Uncategorised spending, overspent categories and targets not funded yet, in one place.',
      route: '/review',
      target: 'review.attention',
    },
    {
      title: 'Next month and buffer',
      body: 'What you’ve already assigned to next month and the months after it.',
      route: '/review',
      target: 'review.buffer',
    },
  ],
};

export const payLaterGuide: Guide = {
  id: 'pay-later',
  version: 1,
  title: 'Pay later',
  summary: 'Afterpay purchases in their real category, and confirming their payments.',
  page: '/payment-plans',
  steps: [
    {
      title: 'What you bought, not who you paid',
      body: 'An Afterpay purchase is recorded once, in its real category, on a small Afterpay account. Its payments then pay that account off.',
      route: '/payment-plans',
      target: 'plans.header',
    },
    {
      title: 'Add a purchase',
      body: 'The shop, category, price, number of payments and the account that pays.',
      route: '/payment-plans',
      target: ['plans.add', 'plans.setup'],
    },
    {
      title: 'Earlier payments',
      body: 'Groups your bank’s past Afterpay payments into the purchases they probably paid for.',
      route: '/payment-plans',
      target: 'plans.earlier',
    },
    {
      title: 'Confirm each payment',
      body: 'Payments from your bank are listed under Payments to confirm, here and on Review. Nothing is linked until you confirm it.',
      route: '/payment-plans',
    },
  ],
};

export const householdGuide: Guide = {
  id: 'household',
  version: 1,
  title: 'Household',
  summary: 'Shared costs: who owes whom, shared bills, and recording an expense.',
  page: '/household',
  steps: [
    {
      title: 'Shared costs, privately',
      body: 'Track what you share with the people you live with: agreed shares, advances and repayments. They don’t get access to your budget.',
      route: '/household',
      target: ['household.header', 'household.create'],
    },
    {
      title: 'People and balances',
      body: 'Who has paid more than their share, and who owes.',
      route: '/household',
      target: 'household.people',
    },
    {
      title: 'Recurring bills',
      body: 'Share bills from Recurring, such as power or internet, each with its own split, and share their payments in one click.',
      route: '/household',
      target: 'household.bills',
    },
    {
      title: 'Record something else',
      body: 'A one-off shared expense, an advance or a repayment.',
      route: '/household',
      target: 'household.record',
    },
  ],
};

export const goalsGuide: Guide = {
  id: 'goals',
  version: 1,
  title: 'Goals',
  summary: 'Saving towards a target and what to set aside each month.',
  page: '/goals',
  steps: [
    {
      title: 'Save for what matters',
      body: 'Set a target like an emergency fund, a trip or a new car. Each goal shows how close you are and how much to set aside each month.',
      route: '/goals',
      target: 'goals.add',
    },
  ],
};

export const forecastGuide: Guide = {
  id: 'forecast',
  version: 1,
  title: 'Forecast',
  summary: 'Your long-term outlook and how long your cash lasts.',
  page: '/forecast',
  steps: [
    {
      title: 'Two forecasts',
      body: 'Long term projects your money over the years. Cash runway shows your balance day by day from today, with expected pay and bills.',
      route: '/forecast',
      target: 'forecast.tabs',
    },
    {
      title: 'A projection, not a promise',
      body: 'Forecasts only read your budget: they never create transactions, bills or assignments. Change the assumptions to see what if.',
      route: '/forecast',
    },
  ],
};

export const investmentsGuide: Guide = {
  id: 'investments',
  version: 1,
  title: 'Investments',
  summary: 'Recording what your investment accounts hold.',
  page: '/investments',
  steps: [
    {
      title: 'Holdings you record',
      body: 'Record what your investment, retirement or crypto accounts hold, and price them yourself. Balances, your budget and net worth only change when you record a value.',
      route: '/investments',
      target: 'investments.header',
    },
    {
      title: 'Add a holding',
      body: 'Add an investment account under Accounts first, then record what it holds here.',
      route: '/investments',
      target: 'investments.add',
    },
  ],
};

export const taxGuide: Guide = {
  id: 'tax',
  version: 1,
  title: 'Tax time',
  summary: 'Deductions, the receipts that prove them, and exports for your return.',
  page: '/tax',
  steps: [
    {
      title: 'Deductions and receipts',
      body: 'Keep the deductions you claim and the receipts that prove them, for your Australian tax return. Record keeping, not tax advice.',
      route: '/tax',
      target: 'tax.header',
    },
    {
      title: 'One financial year at a time',
      body: 'Pick a year (1 July to 30 June). Download its deductions as a CSV file, or with the receipts in a ZIP.',
      route: '/tax',
      target: 'tax.year',
    },
    {
      title: 'Receipt inbox',
      body: 'Add receipts as you get them, then match each one to its transaction when it arrives.',
      route: '/tax',
      target: 'tax.tabs',
    },
  ],
};

export const reportsGuide: Guide = {
  id: 'reports',
  version: 1,
  title: 'Reports',
  summary: 'Dashboards of charts, adding widgets and building your own report.',
  page: '/reports',
  steps: [
    {
      title: 'Dashboards',
      body: 'Reports are dashboards of charts. Switch between them here, or add one with +.',
      route: '/reports',
      target: 'reports.pages',
    },
    {
      title: 'Add a widget',
      body: 'Put another chart on this dashboard.',
      route: '/reports',
      target: 'reports.add',
    },
    {
      title: 'Your own report',
      body: 'Custom Report builds a chart from the data you choose.',
      route: '/reports',
      target: 'reports.custom',
    },
  ],
};

export const settingsGuide: Guide = {
  id: 'settings',
  version: 1,
  title: 'Settings',
  summary: 'Categories, connecting Up, backups and preferences.',
  page: '/settings',
  steps: [
    {
      title: 'Everything in tabs',
      body: 'Categories, account order, when your budget starts, tags, connected banks, currencies, data and preferences each have a tab.',
      route: '/settings',
      target: 'settings.tabs',
    },
    {
      title: 'Connect Up',
      body: 'Under Connected Banks, connect Up and its settled transactions are imported for you, without duplicates. Your token is stored encrypted.',
      route: '/settings',
    },
    {
      title: 'Back up and preferences',
      body: 'Data downloads your data for a backup. Preferences has the theme, Safe mode, and guides and tips.',
      route: '/settings',
    },
  ],
};

export const PAGE_GUIDES: Guide[] = [
  accountsGuide,
  transactionsGuide,
  rulesGuide,
  recurringGuide,
  reviewGuide,
  payLaterGuide,
  householdGuide,
  goalsGuide,
  forecastGuide,
  investmentsGuide,
  taxGuide,
  reportsGuide,
  settingsGuide,
];
