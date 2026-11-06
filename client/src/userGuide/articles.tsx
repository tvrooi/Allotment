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
            Connected banks. You can also turn on background sync there. Each sync fetches recent
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
            An envelope below $0 is red. Click its <b>Available</b> figure to cover it from another
            envelope. Plans change: moving money is normal, and you can give it back to Ready to
            assign. <L to="move-money">How moving money works</L>.
          </p>
        ),
      },
      {
        heading: 'Spending you’ll be paid back for',
        body: (
          <p>
            Normally an envelope that ends the month overspent starts the next one at $0, and the
            money you spent comes out of Ready to assign. For spending someone will pay back, such
            as a work expense, open the category (<b>Settings → Categories → Edit</b>) and tick{' '}
            <b>Keep overspending</b>. Its deficit then carries into the next month and Ready to
            assign isn’t reduced. When the repayment arrives and you give it that category, the
            envelope is back to $0. Review still lists it as overspent, marked as kept until repaid.
          </p>
        ),
      },
      {
        heading: 'Holding money for next month',
        body: (
          <p>
            If you’re living on last month’s pay, or some of this month’s money isn’t for this
            month, choose <b>Hold money…</b> under Ready to assign in the current month and enter
            how much. It leaves Ready to assign now, so the month can reach $0 and read fully
            budgeted, and it comes back when next month starts. It can’t be given to a category
            until then, and you can only hold what is ready to assign. <b>Change hold</b> and{' '}
            <b>Release hold</b> put it back. Nothing is spent or moved out of your accounts.
          </p>
        ),
      },
      {
        heading: 'Filling a month quickly',
        body: (
          <p>
            <b>Assign → Auto-assign</b> plans a whole month at once and shows every change before
            anything is saved. Choose to cover overspending, copy last month’s assignments or
            spending, use the average of the last 3, 6 or 12 months’ spending (months with no
            spending count), or <b>Set to zero</b>. <b>Add</b> only tops envelopes up and never
            lowers one; <b>Replace</b> sets each envelope to the amount, so an envelope that has
            more gives the difference back to Ready to assign (never below $0 assigned). Untick any
            envelope to leave it alone: the rest is planned again, because the money is shared out
            in order. <b>Fund targets</b> has the same ticks. Taking money back can leave an
            envelope overspent, and the preview says so.
          </p>
        ),
      },
      {
        heading: 'What Available is telling you',
        body: (
          <p>
            Red <b>Overspent</b> means the envelope is below $0. <b>Covered by carried funds</b>{' '}
            means you spent more than you assigned this month, but money carried in from earlier
            pays for it, so nothing is wrong. <b>Short of target</b> means there’s money in the
            envelope but not yet what its target needs. The words are there so you don’t have to
            rely on the colour.
          </p>
        ),
      },
      {
        heading: 'If a change is refused',
        body: (
          <p>
            An amount is saved only when the server says so. If it’s refused, for example because it
            is more than you have to assign, the amount stays in the box with the reason beside it,
            so you can fix it. Undo works the same way: if something changed since, it says so and
            leaves your figures alone.
          </p>
        ),
      },
      {
        heading: 'Cards in the budget',
        body: (
          <p>
            A credit card you’ve set up for payment funding has its own row under{' '}
            <b>Card payments</b>. When you spend on the card, the money comes out of the envelope
            you categorised the purchase to and is held in the card’s row, so a $100 Groceries
            envelope with an $80 purchase reads $20 for Groceries and $80 on the card. Under the
            card’s name the row shows what you owe, and in red any part the reserve doesn’t cover.
            When you pay the card from your bank and link the two sides as a transfer, the reserve
            is used up and Groceries stays as it was. Setting up a card, and adding money to its row
            with <b>Fund debt</b>, are in the Card payments panel beside the table.
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
    page: 'move-money',
    title: 'Move money',
    summary: 'Cover an overspent envelope, change your mind, or give money back.',
    sections: [
      {
        heading: 'Start from the envelope',
        body: (
          <p>
            On the Budget page, click the <b>Available</b> figure of an envelope (tap it on a
            phone). If it has money, <b>Move money</b> opens with that envelope as the source: type
            an amount and choose where it goes. If it is overspent (red), the panel opens with that
            envelope as the destination and the amount it is short: choose which envelope pays for
            it. You can also open <b>Move money / Cover overspending</b> yourself and choose both.
          </p>
        ),
      },
      {
        heading: 'Preview, then apply',
        body: (
          <p>
            <b>Preview move</b> shows what each side has available afterwards, and what the move
            does to a funding target: for example, that Groceries would be $50 short of its target
            instead of fully funded. Nothing is saved until you choose <b>Apply move</b>, and{' '}
            <b>Cancel</b> leaves everything as it was. Both envelopes change together, and the move
            can’t take more than the source has, in this month or any month after it. If your budget
            changed since you previewed (another edit, an import), apply is refused and you preview
            again.
          </p>
        ),
      },
      {
        heading: 'Giving money back to Ready to assign',
        body: (
          <p>
            Choose <b>Ready to assign</b> as the destination to take money out of an envelope
            without giving it to another one. Ready to assign rises by exactly that amount, and you
            can assign it to any envelope afterwards, as you would any money that is ready. It is
            not a category: it never appears in your categories or reports.
          </p>
        ),
      },
      {
        heading: 'Undo, and the history',
        body: (
          <p>
            <b>Money move history</b> lists your latest moves, including those that gave money back,
            and <b>Undo move</b> puts both sides back. Undo works only while nothing else in the
            budget has changed since the move: after that, move money again to adjust it. Moves in a
            future month aren’t available. See <L to="budgeting">Budgeting</L> for Ready to assign,
            and what to do about overspending.
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
    page: 'tax',
    title: 'Tax time',
    summary: 'Deductions, receipts and depreciating assets for your Australian return.',
    sections: [
      {
        heading: 'Claims and receipts',
        body: (
          <p>
            Open a transaction and tick <b>Claim as a tax deduction</b>, with its return label and
            the share that was for work. Add the receipt to the transaction, or keep it in Tax
            time’s <b>Receipt inbox</b> until the transaction arrives. Download a year’s deductions
            as a CSV file, or with the receipts in a ZIP, for your return or your tax agent.
          </p>
        ),
      },
      {
        heading: 'Assets that lose value over several years',
        body: (
          <p>
            Something over $300 used for work, such as a laptop, is usually claimed as its decline
            in value over several years. Choose <b>Depreciate instead</b> on the claim, or{' '}
            <b>Add an asset</b> in Tax time → Assets. Pick the ATO’s prime cost or diminishing value
            method after comparing them; Allotment works out each year’s part. Keep its records
            under the asset, record it when you sell it or stop using it, and lock a year once it’s
            lodged.
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
    page: 'households',
    title: 'Households',
    summary: 'Share costs with the people you live with, and keep a record of who changed what.',
    sections: [
      {
        heading: 'Fix a mistake without starting again',
        body: (
          <p>
            Under <b>Household</b>, open <b>All contributions, payments &amp; repayments</b> and
            choose <b>Edit</b> on an entry. You can change its description, and if it isn’t linked
            to a bank payment, its date, amount, who paid and how it’s split. An entry linked to a
            bank payment keeps that payment’s date and amount. An expense that has a refund can only
            change its description. Allotment refuses a change that would leave a repayment larger
            than what was owed, and says why.
          </p>
        ),
      },
      {
        heading: 'See who did what',
        body: (
          <p>
            <b>Activity</b>, below the history, lists what was added, changed, removed or repaid,
            newest first. An entry you remove keeps its line there. Payments shared by a rule or a
            shared recurring bill are marked as theirs. If you combine with another Allotment user,
            their households’ activity is listed with yours.
          </p>
        ),
      },
      {
        heading: 'See where the money went',
        body: (
          <p>
            Under the spending list, <b>Spending by month, person and category</b> uses the same
            date range. It shows each month, what each person paid compared with their share, and
            spending by category, taken from the category of the bank payment an entry is linked to.
            Entries with no payment are under Uncategorised. Repayments aren’t counted as spending.
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
            Settings → Data → <b>Download backup</b> saves your whole budget in one file. Keep it
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
