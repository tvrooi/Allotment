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
            SimpleFIN and <L to="enable-banking">Enable Banking</L> (Europe). Those are community
            supported: they work, but only Up is checked with every release, so if one stops working
            for your bank, CSV files still do.
          </p>
        ),
      },
    ],
  },
  {
    page: 'enable-banking',
    title: 'Enable Banking (Europe)',
    summary: 'Connect a bank in Europe through your own free Enable Banking application.',
    sections: [
      {
        heading: 'What you need',
        body: (
          <p>
            A bank in the European Economic Area and a free account with Enable Banking, which
            connects to banks under Europe’s open banking rules. You make your own application there
            once; Allotment uses it to read your accounts. It can’t move money. Enable Banking is
            community supported: if it stops working for your bank, CSV files still do.
          </p>
        ),
      },
      {
        heading: 'Set up your application',
        body: (
          <ol>
            <li>
              In Allotment, open Settings → Connected banks → <b>Enable Banking</b>, or choose{' '}
              <b>Connect via Enable Banking</b> when you add an account. The setup form shows your
              redirect URL with a <b>Copy</b> button.
            </li>
            <li>
              Sign up in Enable Banking’s Control Panel at{' '}
              <span className="font-mono">enablebanking.com/cp/applications</span> and create a{' '}
              <b>Production</b> application. A Sandbox one only reaches test banks.
            </li>
            <li>Paste the redirect URL into the application’s redirect URLs.</li>
            <li>
              Save the <b>.pem</b> file your browser downloads. It’s the application’s private key,
              and Enable Banking can’t show it again.
            </li>
            <li>
              Choose <b>Activate by linking accounts</b> and log in to your bank there. A free
              application only reaches the accounts you link, so link every account you want in
              Allotment.
            </li>
            <li>
              Back in Allotment, paste the application ID, choose the .pem file and select{' '}
              <b>Check and save</b>. Allotment asks Enable Banking whether they work before saving
              them, and warns you if the redirect URL isn’t on the application yet.
            </li>
          </ol>
        ),
      },
      {
        heading: 'Connect your bank',
        body: (
          <ol>
            <li>Pick your country and your bank, then log in on your bank’s own site.</li>
            <li>
              Your bank sends you back and Allotment carries on by itself. If it can’t (on a server
              without HTTPS, say), copy the whole address from your browser’s address bar and paste
              it into Allotment.
            </li>
            <li>
              Choose where each bank account goes: an account you already have, or a new one.
              Accounts you already import statements into are picked for you, and transactions you
              imported from files are recognised, not added twice.
            </li>
          </ol>
        ),
      },
      {
        heading: 'Keeping it up to date',
        body: (
          <ul>
            <li>
              Allotment syncs when it starts and when you choose <b>Sync now</b>. Banks allow only a
              few automatic updates a day.
            </li>
            <li>
              Only booked transactions come in, in the account’s own currency. Pending ones wait
              until the bank books them.
            </li>
            <li>
              Banks give access for a few months at most (180 days under the rules). Settings →
              Connected banks says when it ends; choose <b>Reconnect</b> and log in again. Your
              accounts and history stay as they are.
            </li>
            <li>
              Your private key is stored encrypted and is never included in backups or exports.
            </li>
          </ul>
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
        heading: 'Working through the list',
        body: (
          <p>
            Click a transaction (or tap it on a phone) to open its details. Use the up and down
            arrows beside <b>Close</b> to open the one above or below without closing the panel.
            They follow the list as you see it, search and filters included. What you typed is saved
            before the next one opens.
          </p>
        ),
      },
      {
        heading: 'Transfers',
        body: (
          <p>
            Money moving between your own accounts, like Spending to a Saver, is a transfer, not
            spending. When Allotment spots the same amount leaving one account and arriving in
            another, it suggests linking them. It never guesses on its own. Up says which account a
            transfer went to, so those pairs come first, under <b>Up reported these</b> in{' '}
            <b>Review</b>; tick the ones that are right and choose <b>Link</b>.
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
            how much (on a phone, open <b>Hold money, and how this is worked out</b> first). It
            leaves Ready to assign now, so the month can reach $0 and read fully budgeted, and it
            comes back when next month starts. It can’t be given to a category until then, and you
            can only hold what is ready to assign. <b>Change hold</b> and <b>Release hold</b> put it
            back. Nothing is spent or moved out of your accounts.
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
        heading: 'Typing amounts',
        body: (
          <p>
            You can type a sum in an envelope’s amount: <b>100+50</b> saves $150 and <b>150*2</b>{' '}
            saves $300. A sum doesn’t add to what was there, so <b>+50</b> saves $50. On a computer,
            press <b>Enter</b> to save, <b>Esc</b> to cancel, and the <b>down arrow</b> or{' '}
            <b>Tab</b> to save and go to the next envelope (<b>up arrow</b> or <b>Shift+Tab</b> for
            the one before). Envelopes you’ve hidden or filtered out are skipped.
          </p>
        ),
      },
      {
        heading: 'The inspector and notes',
        body: (
          <p>
            Beside the table, the inspector shows the whole month until you tick envelopes. Tick one
            to see its figures, its target and its note; tick several to see their totals and fund
            just their targets. Ticking never moves money. Write a note for the month there, or for
            an envelope when it’s ticked (on a phone, in the envelope’s amount sheet). A note saves
            when you leave the box, and an envelope’s note stays the same every month.
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
            with <b>Fund debt</b>, are in the Card payments panel beside the table.{' '}
            <L to="card-payments">More about card payments</L>.
          </p>
        ),
      },
      {
        heading: 'Paid fortnightly',
        body: (
          <p>
            Choose <b>Until payday</b> on the Budget page to plan just until your next pay, with the
            bills that fall before it. <L to="payday-plans">How payday plans work</L>.
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
    page: 'payday-plans',
    title: 'Payday plans',
    summary:
      'Paid fortnightly? Decide what each pay covers, starting with the bills before the next one.',
    sections: [
      {
        heading: 'What a plan does',
        body: (
          <p>
            A payday plan shares out each fortnightly pay in an order you choose, and shows the
            bills due before the next pay. It’s optional: your envelopes still live in the monthly
            budget, and what’s left in them still carries forward. Open <b>Budget</b>, choose{' '}
            <b>Until payday</b>, then <b>New payday plan</b>.
          </p>
        ),
      },
      {
        heading: 'Set it up',
        body: (
          <ol>
            <li>
              Give it a name, an <b>anchor payday</b> (one real payday: pay repeats every 14 days
              from it), your usual take-home pay, and what to do when payday falls on a weekend.
            </li>
            <li>
              <b>Add funding rule</b> for each envelope the pay should fill, in order.{' '}
              <b>Move up</b> changes the order. Bills due before the next pay are covered first,
              unless you give their envelope a rule of its own to choose where it comes.
            </li>
            <li>
              <b>Save payday plan</b>. If you’re paid by more than one employer, make a plan for
              each.
            </li>
          </ol>
        ),
      },
      {
        heading: 'Kinds of rule',
        body: (
          <ul>
            <li>
              <b>Bills until next payday</b>: enough for the bills before the next pay.
            </li>
            <li>
              <b>Fixed per pay</b>: the same amount every payday.
            </li>
            <li>
              <b>Target by date</b>: a balance by a date, shared over the paydays left until then.
            </li>
            <li>
              <b>Smooth monthly cost</b>: a monthly cost spread over the year’s paydays, catching up
              if a bill needs more sooner.
            </li>
            <li>
              <b>Percentage of pay</b>: a share of the pay you received.
            </li>
            <li>
              <b>Category target</b>: what the envelope’s target still needs this month, shared
              between this and the month’s other paydays.
            </li>
            <li>
              <b>Remainder</b>: whatever is left, always last.
            </li>
          </ul>
        ),
      },
      {
        heading: 'On payday',
        body: (
          <p>
            Choose the payday, and change its date if the pay came early or late. Under{' '}
            <b>Income received</b>, tick the pay that arrived. <b>Preview funding</b> shows what
            each envelope has, what it needs, what this pay adds, and any bill it can’t cover before
            the next pay. Nothing is saved until <b>Apply funding</b>, which adds the amounts to
            this month’s budget. Each payday is applied once, and each deposit is used by one plan
            only. Any part of the pay the plan doesn’t use stays in Ready to assign.
          </p>
        ),
      },
      {
        heading: 'Expected pay isn’t money yet',
        body: (
          <p>
            The take-home pay in the plan is only for planning. Only pay that has arrived can be
            assigned, so you can preview a future payday but not apply it.
          </p>
        ),
      },
      {
        heading: 'Undo and history',
        body: (
          <p>
            <b>Funding history</b> lists every payday you applied and what went where. <b>Undo</b>{' '}
            takes the amounts back out of the envelopes, and lists anything it couldn’t take back.{' '}
            <b>Archive plan</b> stops using a plan and keeps its history. Editing a plan never
            changes a payday you already applied. To plan a month instead, see{' '}
            <L to="budgeting">Budgeting</L>.
          </p>
        ),
      },
    ],
  },
  {
    page: 'card-payments',
    title: 'Card payments',
    summary: 'Keep the cash for what you spend on a credit card, ready for the bill.',
    sections: [
      {
        heading: 'Why a card has its own row',
        body: (
          <p>
            Spending on a credit card doesn’t leave your bank until you pay the card. Once a card is
            set up for payment funding, Allotment keeps the money for each purchase aside in the
            card’s row under <b>Card payments</b> on the Budget page, so it’s there when the bill
            comes.
          </p>
        ),
      },
      {
        heading: 'Set up a card',
        body: (
          <p>
            In the <b>Card payments</b> panel beside the budget, choose <b>Review … setup</b> for
            the card. Enter how much cash to put aside for what you already owe, then{' '}
            <b>Preview card setup</b>: it shows the debt, the reserve, what isn’t covered yet, and
            Ready to assign before and after. Nothing changes until <b>Enable payment funding</b>.
            Your past transactions stay as they are: what you owed on the day is the card’s opening
            debt.
          </p>
        ),
      },
      {
        heading: 'Spending on the card',
        body: (
          <p>
            Give a card purchase its usual category. With $100 in Groceries, an $80 purchase leaves
            $20 in Groceries and moves $80 into the card’s row. Ready to assign doesn’t change,
            because the money was already budgeted.
          </p>
        ),
      },
      {
        heading: 'Paying the card',
        body: (
          <p>
            When you pay the card from your bank, link the two sides as a transfer. The payment uses
            up the card’s reserve and lowers what you owe. It isn’t spending: the purchases already
            were.
          </p>
        ),
      },
      {
        heading: 'When the reserve is short',
        body: (
          <p>
            Under the card’s name the row shows what you owe, and in red any part the reserve
            doesn’t cover, for example purchases from an overspent envelope. <b>Fund debt</b> in the
            panel adds money from Ready to assign (in the current month, previewed first), or you
            can <L to="move-money">move money</L> into the card’s row from another envelope. Review
            lists card debt without a reserve until it’s covered.
          </p>
        ),
      },
      {
        heading: 'Cards not set up',
        body: (
          <p>
            Until you set a card up, its purchases count like cash spending, and what you owe on it
            comes off Ready to assign. Setting it up is optional.
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
      {
        heading: 'Shared houses',
        body: (
          <p>
            Money your housemates put into a household account is never your income: Monthly keeps
            it under <b>Household account</b>, out of your totals, and the dashboard&rsquo;s next
            pay is only your own. A bill the household shares counts at your share, such as
            &ldquo;Your share of Rent&rdquo;, with the full amount beside it.
          </p>
        ),
      },
    ],
  },
  {
    page: 'review',
    title: 'Budget review',
    summary: 'A check-up of your budget, and how much room you have if plans change.',
    sections: [
      {
        heading: 'A check-up that changes nothing by itself',
        body: (
          <p>
            <b>Review</b> lists what needs your attention, most urgent first, worked out from your
            budget as it is now. Nothing changes until you act on an item, and fixing one there
            updates the budget and the forecast too.
          </p>
        ),
      },
      {
        heading: 'Coming back after a break',
        body: (
          <p>
            <b>Resume budgeting</b> says how long since your last review, how many transactions
            arrived since, what spending has no category, which accounts to reconcile and, with Up
            connected, the bank changes to look at. Start with today’s plan: you don’t need to sort
            out old transactions first. <b>Mark review complete</b> saves the date and today’s
            figures, so next time <b>Since your last review</b> can compare. It moves no money and
            reconciles nothing.
          </p>
        ),
      },
      {
        heading: 'Needs attention',
        body: (
          <ul>
            <li>Spending with no category: choose one right there.</li>
            <li>
              Overspent envelopes: <L to="move-money">move money</L> from one that has some.
            </li>
            <li>
              Targets not yet funded: <b>Fund targets</b> previews it first.
            </li>
            <li>
              Card debt without a reserve: see <L to="card-payments">Card payments</L>.
            </li>
            <li>Money assigned to later months, which is already spoken for today.</li>
            <li>Ready to assign that is left over, or below $0.</li>
          </ul>
        ),
      },
      {
        heading: 'Guided setup',
        body: (
          <p>
            Six steps for a budget that’s ready for the month: confirm your balances, cover what’s
            due before your next pay, assign the money you have, prepare for irregular bills, check
            categories, and move money when priorities change. Each is checked against your budget
            as it is now, so a step is done when the budget says so.
          </p>
        ),
      },
      {
        heading: 'Room to change plans',
        body: (
          <p>
            This part is optional. In <b>Settings → Priorities</b>, mark envelopes as{' '}
            <b>Essential</b>, <b>Enjoyment</b> or <b>Flexibility reserve</b> (money for no
            particular deadline), and set a minimum and a comfort target. Review’s{' '}
            <b>Flexibility and resilience</b> card then shows the reserve you have today and about
            how many months of essentials it would cover. Super, investments, property, expected pay
            and money owed to you never count. Move money warns you when a move takes the reserve
            below its minimum, and still lets you.
          </p>
        ),
      },
      {
        heading: 'Next month and how long your cash lasts',
        body: (
          <p>
            <b>Next month and buffer</b> shows what’s already assigned to next month and what its
            targets still need. Its cash runway estimates how many days your cash would last at your
            spending over the last three months, assuming no more pay. Money set aside for dated
            bills and cards isn’t counted, and super and investments never are.
          </p>
        ),
      },
      {
        heading: 'Extra income and reminders',
        body: (
          <p>
            Got a bonus or a windfall? Under <b>Extra income</b>, choose the deposit, say what your
            usual pay is (0 for a windfall) and what share of the extra goes to your flexibility
            reserve, then <b>Preview split</b> and <b>Apply split</b>. To be reminded to review, set
            how often in Settings → Priorities; a banner then shows on Review and the dashboard when
            one is due, and <b>Remind me in a week</b> puts it off.
          </p>
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
          <>
            <p>
              Pick a <b>Progress source</b> when you add a goal. <b>A category:</b> progress is the
              money available in that envelope. Assigning to it on the Budget moves you closer;
              spending from it or moving money out moves you back.
            </p>
            <p>
              <b>Manual tracking:</b> you update <b>Saved so far</b> yourself. You can link an
              account (like an emergency fund in a Saver) for reference, but its balance doesn’t
              update the goal.
            </p>
            <p>Either way, give it a target amount and, if you like, a date.</p>
          </>
        ),
      },
    ],
  },
  {
    page: 'long-term-forecast',
    title: 'Long-term forecast',
    summary: 'Your net worth over the decades, with super, study loans and life events.',
    sections: [
      {
        heading: 'What it shows',
        body: (
          <p>
            <b>Forecast → Long term</b> projects your net worth year by year, from today’s real
            balances to an age you choose (95 unless you change it). It’s a projection, not a
            promise, and it never changes your budget. Day-by-day cash for the next months is on the{' '}
            <b>Cash runway</b> tab.
          </p>
        ),
      },
      {
        heading: 'Start a plan',
        body: (
          <p>
            Give the plan a name and your birth year. Everything else starts at a default you can
            change, and each one says so beside its box (“Assumption, default …”). Income is your
            take-home pay, from your payday plans or recurring pay; spending starts from your last
            12 months. You can keep several plans and <b>Compare</b> them.
          </p>
        ),
      },
      {
        heading: 'Life events',
        body: (
          <p>
            Add what you expect to happen: buy a home, a new job, a career break, a child, a
            windfall or one-off expense, a recurring income or expense, retirement, or paying off a
            loan. Each has its own editor, and <b>Create</b> saves that event on its own. Changes to
            assumptions, accounts and savings wait until you choose <b>Save changes</b> (or{' '}
            <b>Discard changes</b>).
          </p>
        ),
      },
      {
        heading: 'Super',
        body: (
          <p>
            Every retirement account is treated as super. Your employer’s contributions go in at the
            super guarantee rate, less contributions tax, and you can add salary sacrifice and your
            own contributions under <b>Assumptions</b>. Super stays preserved until you retire at
            your preservation age, or turn 65: until then it grows but can’t cover a shortfall. The
            chart shows what you could spend (accessible) apart from what’s still locked in super
            (preserved), and the figures above it show what’s accessible when you retire.
            Contribution caps are warned about, not enforced. The Age Pension is an amount you type
            in.
          </p>
        ),
      },
      {
        heading: 'HECS-HELP and other study loans',
        body: (
          <p>
            A student loan account is treated as a study loan: no interest, but the debt rises each
            1 June with indexation, and you repay it through tax once your income passes the
            threshold. By default your take-home pay already has the repayment taken out, so your
            cash doesn’t change while the debt lasts, and that money comes back once it’s repaid.
            The page says the year your study loans are repaid. Add an extra yearly payment under{' '}
            <b>Accounts</b> to see how much sooner, and how much indexation it saves.
          </p>
        ),
      },
      {
        heading: 'Reading the result',
        body: (
          <p>
            <b>Today’s dollars</b> (the default) takes inflation out, so a figure in 30 years reads
            like money now; <b>Future dollars</b> shows the actual amounts. Pick a year under{' '}
            <b>See what made up a year</b> for every part of it, adding up to the cent.{' '}
            <b>Simulation</b> runs your plan through many different market years and shows the
            chance of success: how often the money lasts. Not modelled: income tax, capital gains
            tax, the Age Pension means test and a second person.
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
    page: 'investments',
    title: 'Investments',
    summary: 'Holdings, prices, purchases, sales and dividends, and what Tax time does with them.',
    sections: [
      {
        heading: 'Holdings you price yourself',
        body: (
          <p>
            Add a security (a share, ETF, fund or coin), then a holding of it in an investment,
            retirement or crypto account, and type in prices as you see them: Allotment doesn’t
            fetch quotes. Holdings never change an account’s balance until you choose{' '}
            <b>Record as value</b>.
          </p>
        ),
      },
      {
        heading: 'Purchases and cost',
        body: (
          <p>
            Under <b>Purchases and cost</b>, record when units were bought and what they cost in
            total, brokerage included. A cost you don’t know stays unknown, never zero, and no gain
            is shown for it.
          </p>
        ),
      },
      {
        heading: 'Selling',
        body: (
          <p>
            Choose <b>Sell</b> on a holding and copy the contract note: the trade date, units,
            proceeds and sale brokerage. The oldest purchases are sold first unless you{' '}
            <b>Choose parcels</b>. Before you save, you see each parcel’s cost, its gain or loss and
            whether it was held 12 months or more (the 50% discount). The units leave the holding;
            the cash is whatever your bank recorded. A holding with every unit sold moves under{' '}
            <b>Sold</b>.
          </p>
        ),
      },
      {
        heading: 'Dividends and interest',
        body: (
          <p>
            Choose <b>Record a payment</b> on a holding and copy the statement: the amount paid, the
            franked and unfranked amounts, the franking credit and any tax withheld. If you don’t
            have the credit, work it out at 30% or 25% from the franked amount. Tick{' '}
            <b>Reinvested through a dividend plan</b> for units you were allotted: they become a
            purchase of their own. Under <b>Income</b>, link the payment to its deposit in your bank
            account (suggested by amount and date), and keep the statement with it.
          </p>
        ),
      },
      {
        heading: 'Investments on Tax time',
        body: (
          <p>
            <L to="tax">Tax time</L> shows each year’s sales with item 18’s figures: total capital
            gains, the net capital gain after losses and the discount, and losses carried forward.
            Enter net capital losses from before you used Allotment once. Dividends add up to item
            11 and interest to item 10. Distributions from ETFs and managed funds are shown apart:
            the fund’s annual tax statement says how they go on your return. Super accounts are left
            out, because the fund pays their tax. Lock a year once it’s lodged so its figures can’t
            change. It’s record keeping, not tax advice: splits aren’t covered yet.
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
