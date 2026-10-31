import type { Guide } from './types';

/** The basics, page by page: offered once to a new budget, and kept in the ? menu */
export const welcomeTour: Guide = {
  id: 'welcome',
  version: 1,
  title: 'Welcome tour',
  summary:
    'The basics in about two minutes: accounts, transactions, your budget and where help is.',
  steps: [
    {
      title: 'Welcome to Allotment',
      body: 'Allotment is an envelope budget: you give every dollar you have a job, then spend from those envelopes. This tour shows the basics in about two minutes. You can leave at any time and take it again later.',
    },
    {
      title: 'Find your way around',
      body: 'Every page is in the sidebar. Dashboard, Accounts, Transactions and Budget are the ones you’ll use most.',
      phoneBody:
        'Every page is in the menu at the top left. Dashboard, Accounts, Transactions and Budget are the ones you’ll use most.',
      target: ['nav.main', 'nav.menu'],
    },
    {
      title: 'Your accounts',
      body: 'Add each account you want to track: everyday and savings accounts, credit cards, loans or cash. Bring in transactions by connecting a bank, importing a file from your bank, or adding them by hand.',
      route: '/accounts',
      target: 'accounts.add',
    },
    {
      title: 'Transactions',
      body: 'Every transaction from every account, in one list. Select one to change its category, payee or notes, or use Add to enter one by hand. Changed something by mistake? Ctrl+Z (⌘Z on a Mac) undoes it.',
      phoneBody:
        'Every transaction from every account, in one list. Tap one to change its category, payee or notes, or tap Add to enter one by hand.',
      route: '/transactions',
      target: 'transactions.add',
    },
    {
      title: 'Ready to assign',
      body: 'This is money you have that isn’t in a category yet. Give it to categories until this reaches zero, so every dollar has a job. Spending takes money out of a category, not out of here.',
      route: '/budget',
      target: 'budget.ready',
    },
    {
      title: 'Categories are envelopes',
      body: 'Assigned is what you put in a category this month, Activity is what you spent from it, and Available is what’s left. Click an amount to assign money to a category.',
      phoneBody:
        'Each category is an envelope. Tap an amount to assign money to it; what’s left to spend shows beside it.',
      route: '/budget',
      target: ['budget.columns', 'budget.categories'],
    },
    {
      title: 'Cover overspending',
      body: 'Spent more than you planned somewhere? Move money from a category with some to spare. It’s still your money, just with a different job.',
      route: '/budget',
      target: 'budget.move',
    },
    {
      title: 'Review',
      body: 'A checklist of what needs attention: uncategorised spending, overspent categories and targets not funded yet. It only reads; nothing changes until you act.',
      route: '/review',
      target: 'review.header',
    },
    {
      title: 'Bills and pay',
      body: 'Add the bills and pay that repeat. Allotment shows what’s coming up, and the Budget page shows each category’s unpaid bills for the month.',
      route: '/recurring',
      target: 'recurring.header',
    },
    {
      title: 'Your dashboard',
      body: 'Balances, spending and upcoming bills at a glance. Customize picks which cards show on this device, and Reports has more charts.',
      route: '/dashboard',
      target: 'dashboard.customize',
    },
    {
      title: 'Hide amounts',
      body: 'Someone looking over your shoulder? The eye hides amounts on screen, or press Alt+Shift+H. It only changes what’s shown.',
      phoneBody:
        'Someone looking over your shoulder? The eye at the top right hides amounts on screen. It only changes what’s shown.',
      target: 'nav.safe-mode',
    },
    {
      title: 'Guides and tips',
      body: 'The ? button at the top of the sidebar takes this tour again, opens the guide for the page you’re on, or the online guide. Press ? on your keyboard to see every guide. Turn tips on or off in Settings → Preferences.',
      phoneBody:
        'In the menu, the ? button takes this tour again or opens the guide for the page you’re on. Turn tips on or off in Settings → Preferences.',
      target: 'nav.help',
    },
  ],
};
