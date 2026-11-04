// Allotment's own short user guide, served by the app at /guide (every install, offline, and
// the demo). One page per topic; each is a few short sections in plain words. Pages link to
// each other with <GuideLink>. Keep it short: it's a quick start, not a manual.
import type { ReactNode } from 'react';
import type { DocsPage } from '../utils/project';
import { GuideLink } from '../components/guide/GuideLink';

export interface GuideArticle {
  page: DocsPage;
  title: string;
  /** One line under the title, and on the guide's contents */
  summary: string;
  sections: { heading: string; body: ReactNode }[];
}

const L = ({ to, children }: { to: DocsPage; children: ReactNode }) => (
  <GuideLink page={to} className="font-medium text-brand-600 hover:text-brand-700">
    {children}
  </GuideLink>
);

export const GUIDE_ARTICLES: GuideArticle[] = [
  {
    page: 'getting-started',
    title: 'Getting started',
    summary: 'From an empty budget to every dollar with a job, in about ten minutes.',
    sections: [
      {
        heading: 'The idea',
        body: (
          <p>
            Allotment is an envelope budget. Money you already have goes into envelopes (categories)
            for what it’s for: rent, groceries, the next holiday. When you spend, it comes out of
            that envelope. If every dollar has a job, you always know what you can spend.
          </p>
        ),
      },
      {
        heading: 'Five steps',
        body: (
          <ol>
            <li>
              <b>Connect Up</b> (or add accounts by hand). See <L to="bank-sync">Connecting Up</L>.
            </li>
            <li>
              <b>Check your transactions.</b> Give anything without a category a home; rules can do
              it for you next time.
            </li>
            <li>
              <b>Add your pay and bills</b> as recurring items, so you can see what’s coming.
            </li>
            <li>
              <b>Assign your money.</b> On Budget, give each envelope an amount until Ready to
              assign reaches $0. See <L to="budgeting">Budgeting</L>.
            </li>
            <li>
              <b>Come back every payday.</b> Assign the new pay and move money if plans changed.
            </li>
          </ol>
        ),
      },
      {
        heading: 'Where your data is',
        body: (
          <p>
            Your budget lives on your own computer or your own Home Assistant. There’s no Allotment
            account and no tracking. Keep a backup: see <L to="backups">Backups</L>.
          </p>
        ),
      },
    ],
  },
  {
    page: 'bank-sync',
    title: 'Connecting Up',
    summary: 'Bring in your Spending account, Savers and 2Up with a read-only token.',
    sections: [
      {
        heading: 'What you need',
        body: (
          <p>
            An Up account and a <b>personal access token</b>: a long password Up gives you for apps
            like Allotment. It can only <b>read</b> your accounts; it can’t move money. You can
            revoke it in Up at any time.
          </p>
        ),
      },
      {
        heading: 'Connect in three steps',
        body: (
          <ol>
            <li>
              Open Up’s developer portal at <span className="font-mono">api.up.com.au</span> and
              sign in with the Up app on your phone.
            </li>
            <li>
              Copy the token it shows. It starts with <span className="font-mono">up:yeah:</span>.
            </li>
            <li>
              In Allotment, choose <b>Connect Up</b>, paste the token, and pick the accounts to
              bring in.
            </li>
          </ol>
        ),
      },
      {
        heading: 'What comes in',
        body: (
          <ul>
            <li>
              Settled transactions in Australian dollars. Pending ones wait until they settle.
            </li>
            <li>Your Savers and 2Up accounts, if you choose them.</li>
            <li>Up’s categories where they match yours; the rest you sort once.</li>
            <li>Nothing twice: each Up transaction has a stable ID.</li>
          </ul>
        ),
      },
      {
        heading: 'Keeping it up to date',
        body: (
          <p>
            Allotment syncs when it starts and when you choose <b>Sync Now</b> in Settings →
            Connected Banks. You can also turn on background sync there. Each sync fetches recent
            transactions; all of Up's history is checked once a week, or straight away with{' '}
            <b>Check all history</b>. Your token is stored encrypted and is never included in
            backups or exports.
          </p>
        ),
      },
      {
        heading: 'Other banks',
        body: (
          <p>
            Any bank: add the account and import the CSV files your bank exports (see{' '}
            <L to="transactions">Transactions</L>). Allotment can also connect through Plaid,
            SimpleFIN and Enable Banking (Europe). Those are community supported: they work, but
            only Up is checked with every release, so if one stops working for your bank, CSV files
            still do.
          </p>
        ),
      },
    ],
  },
  {
    page: 'accounts',
    title: 'Accounts',
    summary: 'Everything that holds money, or that you owe on.',
    sections: [
      {
        heading: 'On budget and off budget',
        body: (
          <p>
            <b>On-budget</b> accounts (Spending, Savers, 2Up, cash) hold the money you assign to
            envelopes. <b>Off-budget</b> accounts (super, shares, a car loan) count towards your net
            worth but not your budget.
          </p>
        ),
      },
      {
        heading: 'Reconciling',
        body: (
          <p>
            Every so often, compare an account’s balance with your bank and choose <b>Reconcile</b>.
            Reconciled transactions are locked in, so a later import never changes them.
          </p>
        ),
      },
    ],
  },
  {
    page: 'transactions',
    title: 'Transactions',
    summary: 'Sorting, splitting, transfers and importing files.',
    sections: [
      {
        heading: 'Give each one a category',
        body: (
          <p>
            A transaction without a category isn’t in any envelope yet, so it comes off Ready to
            assign. Choose a category, or let a <L to="rules">rule</L> do it.
          </p>
        ),
      },
      {
        heading: 'Transfers',
        body: (
          <p>
            Money moving between your own accounts, like Spending to a Saver, is a transfer, not
            spending. When Allotment spots the same amount leaving one account and arriving in
            another, it suggests linking them. It never guesses on its own.
          </p>
        ),
      },
      {
        heading: 'Splits',
        body: <p>One purchase, several envelopes: split it by amount or percentage.</p>,
      },
      {
        heading: 'Importing files',
        body: (
          <p>
            From an account’s page, choose <b>Import</b> and pick a CSV or CAMT file from your bank.
            You see a preview before anything is added.
          </p>
        ),
      },
    ],
  },
  {
    page: 'budgeting',
    title: 'Budgeting',
    summary: 'Ready to assign, envelopes, overspending and paydays.',
    sections: [
      {
        heading: 'Ready to assign',
        body: (
          <p>
            Money you have that isn’t in an envelope yet. Assign it until it reaches $0. If it goes
            below $0, you’ve assigned more than you have: take some back from an envelope.
          </p>
        ),
      },
      {
        heading: 'Envelopes carry forward',
        body: (
          <p>
            What’s left in an envelope at the end of the month stays there. That’s how you save up
            for bills that don’t come every month, like rego or a holiday.
          </p>
        ),
      },
      {
        heading: 'Overspent?',
        body: (
          <p>
            An envelope below $0 is red. Use <b>Move money</b> to cover it from another envelope.
            Plans change: moving money is normal.
          </p>
        ),
      },
      {
        heading: 'Paid fortnightly',
        body: (
          <p>
            Choose <b>Until payday</b> on the Budget page to plan just until your next pay, with the
            bills that fall before it.
          </p>
        ),
      },
    ],
  },
  {
    page: 'recurring',
    title: 'Bills and pay',
    summary: 'Recurring items show what’s due, and what’s coming in.',
    sections: [
      {
        heading: 'Add what repeats',
        body: (
          <p>
            Rent, pay, subscriptions, rego: add them under Recurring with how often they happen. The
            dashboard then shows your next bills and your next pay.
          </p>
        ),
      },
      {
        heading: 'Matching',
        body: (
          <p>
            When a payment arrives from Up, Allotment matches it to its recurring item. If it isn’t
            sure, it asks you to confirm the match.
          </p>
        ),
      },
      {
        heading: 'Find recurring',
        body: (
          <p>Allotment can look through your history for things that repeat and suggest them.</p>
        ),
      },
    ],
  },
  {
    page: 'rules',
    title: 'Rules',
    summary: 'Sort new transactions automatically.',
    sections: [
      {
        heading: 'How they work',
        body: (
          <p>
            A rule says: when a transaction matches these conditions (payee, bank text, amount,
            account), do these things (set the payee, the category, notes, or split it). Rules run
            on every import and sync, and on what you type.
          </p>
        ),
      },
      {
        heading: 'Check before you save',
        body: (
          <p>While you write a rule, Allotment shows which past transactions it would match.</p>
        ),
      },
    ],
  },
  {
    page: 'goals',
    title: 'Goals',
    summary: 'Save towards something, and see when you’ll get there.',
    sections: [
      {
        heading: 'Two kinds',
        body: (
          <p>
            A goal can follow an account (like an emergency fund in a Saver) or an envelope (like a
            holiday). Give it a target amount and, if you like, a date.
          </p>
        ),
      },
    ],
  },
  {
    page: 'reports',
    title: 'Reports',
    summary: 'Where the money goes, over any period.',
    sections: [
      {
        heading: 'Dashboards and reports',
        body: (
          <p>
            Reports has dashboards of cards (net worth, spending, income) that you arrange, plus a
            builder for your own reports. Every figure exports to CSV.
          </p>
        ),
      },
    ],
  },
  {
    page: 'currencies',
    title: 'Currencies',
    summary: 'Accounts in another currency.',
    sections: [
      {
        heading: 'One budget currency',
        body: (
          <p>
            Your budget is in one currency (Australian dollars for most people). An account in
            another currency is converted at the day’s rate, which you can type in or download in
            Settings → Currencies.
          </p>
        ),
      },
    ],
  },
  {
    page: 'backups',
    title: 'Backups',
    summary: 'Keep a copy of your budget somewhere safe.',
    sections: [
      {
        heading: 'Download a backup',
        body: (
          <p>
            Settings → Data → <b>Download Backup</b> saves your whole budget in one file. Keep it
            somewhere other than the computer or Home Assistant it runs on. Your Up token is never
            included.
          </p>
        ),
      },
      {
        heading: 'Restore',
        body: (
          <p>
            Settings → Data → <b>Restore Backup</b> replaces the budget with a backup. You’re asked
            to confirm first.
          </p>
        ),
      },
    ],
  },
];

export const articleFor = (page: string | undefined) => GUIDE_ARTICLES.find((a) => a.page === page);
