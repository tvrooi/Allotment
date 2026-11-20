import { useState, useEffect, useId } from 'react';
import { useMatch } from 'react-router-dom';
import { format, isValid as isValidDate, parseISO } from 'date-fns';
import { MinusCircle, PlusCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SavedOnDeviceHint } from '../connection/SavingPausedHint';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Combobox } from '../ui/Combobox';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import type { ListGroup } from '../ui/listItems';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { formatMoney } from '../../utils/currency';
import { useAccounts, useCreateAccount } from '../../hooks/useAccounts';
import { useCanSave } from '../../hooks/useConnection';
import { useAddTransaction } from '../../hooks/useOffline';
import { useAccountCurrency, useConverted } from '../../hooks/useCurrency';
import { MerchantSelect } from './MerchantSelect';
import { CategorySelectButton } from './CategorySelectButton';
import { AccountIcon } from '../accounts/AccountIcon';
import { useHideBalances } from '../../utils/safeMode';
import { Private } from '../ui/Private';
import { formatDay } from '../../utils/dates';
import {
  defaultAddAccount,
  readLastAddAccount,
  rememberAddAccount,
} from '../../utils/addTransaction';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddTransactionModal({ isOpen, onClose }: Props) {
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const hideBalances = useHideBalances();
  const fieldId = useId();
  const [amount, setAmount] = useState(0);
  const [payeeName, setPayeeName] = useState('');
  const [payeeId, setPayeeId] = useState<string | null>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  // A transfer between currencies: the amount on the other account's side, in its currency.
  // Filled in at the day's rate until it's typed over (the bank's rate and fees differ).
  const [otherAmount, setOtherAmount] = useState(0);
  const [otherTyped, setOtherTyped] = useState(false);
  const currencyOf = useAccountCurrency();

  // The account list is drawn inside the dialog, so its options and footer belong to it
  const [accountListHost, setAccountListHost] = useState<HTMLDivElement | null>(null);

  const { data: accounts = [], isError: accountsFailed } = useAccounts();
  // On an account's page (its register or reconcile), that account
  const pageAccountId = useMatch('/accounts/:id/*')?.params.id ?? null;
  const newTx = useAddTransaction();
  const createAccount = useCreateAccount();
  const canSave = useCanSave();
  const [accountError, setAccountError] = useState('');
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);

  const openAccounts = accounts.filter((a) => !a.closedAt);
  // The category list always ends with a transfer to each other account (issue #89), even
  // before the account is chosen
  const transferAccounts = openAccounts.filter((a) => a.id !== accountId);
  const transferToId = categoryId?.startsWith('transfer:')
    ? categoryId.slice('transfer:'.length)
    : null;
  // A transfer's own side can't be the account it goes to
  const accountChoices = openAccounts.filter((a) => a.id !== transferToId);
  const onBudgetAccounts = accountChoices.filter((a) => !a.isOffBudget);
  const offBudgetAccounts = accountChoices.filter((a) => a.isOffBudget);
  // Each account with its icon and its balance; the balance stays inside Private (Safe mode)
  const accountOption = (a: (typeof accountChoices)[number]) => ({
    value: a.id,
    label: a.name,
    icon: <AccountIcon name={a.name} type={a.type} logo={a.logo} />,
    trailing: (
      <span
        className={`text-xs tabular-nums shrink-0 ${a.balance >= 0 || hideBalances ? 'text-text-tertiary' : 'text-negative'}`}
      >
        <Private>{formatMoney(a.balance, a.currency)}</Private>
      </span>
    ),
  });
  const accountGroups: ListGroup[] = [
    { label: 'On budget', options: onBudgetAccounts.map(accountOption) },
    { label: 'Off budget', options: offBudgetAccounts.map(accountOption) },
  ].filter((group) => group.options.length > 0);
  const selectedAccount = openAccounts.find((a) => a.id === accountId);
  const cashAccount = openAccounts.find((a) => a.type === 'cash');
  // A hand-entered row on a bank-fed account makes it disagree with the bank until it is fixed
  const bankFed = !transferToId && !!selectedAccount?.bankLinked;
  const accountLabel = transferToId
    ? type === 'debit'
      ? 'From account'
      : 'To account'
    : 'Account';
  const ownCurrency = currencyOf(accountId || null);
  const otherCurrency = transferToId ? currencyOf(transferToId) : null;
  const crossCurrency = !!transferToId && !!accountId && ownCurrency !== otherCurrency;
  const otherName = openAccounts.find((a) => a.id === transferToId)?.name ?? 'the other account';
  const { data: converted } = useConverted(
    { from: ownCurrency, to: otherCurrency, date, amount },
    crossCurrency && !otherTyped,
  );
  // Until it's typed: the day's rate, or nothing when there's no rate (never one left over
  // from another day, amount or account)
  useEffect(() => {
    if (!crossCurrency || otherTyped) return;
    setOtherAmount(converted?.amount ?? 0);
  }, [crossCurrency, otherTyped, converted]);

  const hasConfirmedMerchant = payeeId !== null;
  const dateValid = date !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidDate(parseISO(date));
  // Text in the amount that isn't an amount: the amount from before would be saved
  const { allValid: amountValid, report } = useAmountValidity();
  // From the Cash create request until the list holds the new account: the dialog would
  // otherwise still save to the previous account (perhaps the bank-fed one), and a second press
  // would make a second Cash account
  const switching = createAccount.isPending || pendingAccountId !== null;
  const isValid =
    !switching &&
    amount > 0 &&
    amountValid &&
    (!crossCurrency || otherAmount > 0) &&
    (hasConfirmedMerchant || transferToId !== null) &&
    dateValid &&
    accountId !== '';

  // Each opening starts afresh, before its first render: the Amount field takes focus straight
  // away, and must not show what was typed last time
  const [shownOpen, setShownOpen] = useState(false);
  if (isOpen !== shownOpen) {
    setShownOpen(isOpen);
    if (isOpen) {
      setType('debit');
      setAmount(0);
      setPayeeName('');
      setPayeeId(null);
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setAccountId(defaultAddAccount(accounts, pageAccountId, readLastAddAccount()));
      setAccountError('');
      setPendingAccountId(null);
      setCategoryId(null);
      setNotes('');
      setOtherAmount(0);
      setOtherTyped(false);
    }
  }

  // Ready to type the amount. This runs after ui/Modal's own effect, which focuses the dialog
  // itself (child effects run first); focus still goes back to the opener on close.
  useEffect(() => {
    if (isOpen) document.getElementById(`${fieldId}-amount`)?.focus();
  }, [isOpen, fieldId]);

  // A just-created account is chosen once the list holds it. React Aria refreshes the text when a
  // late option arrives only while the field is not focused, and the footer keeps focus in it
  useEffect(() => {
    if (!pendingAccountId || !accounts.some((a) => a.id === pendingAccountId)) return;
    setPendingAccountId(null);
    setAccountId(pendingAccountId);
  }, [pendingAccountId, accounts]);
  // The list could not be reloaded: stop waiting for it and say so, rather than hold the dialog
  useEffect(() => {
    if (!pendingAccountId || !accountsFailed) return;
    setPendingAccountId(null);
    setAccountError(
      'The Cash account was made, but the account list could not be reloaded. Choose Cash again.',
    );
  }, [pendingAccountId, accountsFailed]);

  function chooseAccount(id: string) {
    setAccountId(id);
    // A transfer to the account just chosen would go nowhere
    if (categoryId === `transfer:${id}`) setCategoryId(null);
  }

  /** Pick the Cash account, making one first when there is none (cash never touches a bank feed) */
  async function chooseCash() {
    if (switching) return;
    setAccountError('');
    if (cashAccount) return chooseAccount(cashAccount.id);
    try {
      const created = await createAccount.mutateAsync({
        name: 'Cash',
        type: 'cash',
        startingBalance: 0,
      });
      // Chosen once the account list has it: the field shows a chosen account by its option
      setPendingAccountId(created.id);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Could not create the Cash account');
    }
  }

  function handleSubmit() {
    if (!isValid) return;
    rememberAddAccount(accountId);
    if (transferToId) {
      // A debit moves money out of this account, a credit brings it in. Between currencies,
      // each side's amount is in its own account's currency.
      const [sent, arrived] = type === 'debit' ? [amount, otherAmount] : [otherAmount, amount];
      newTx.add(
        {
          kind: 'transfer',
          data: {
            fromAccountId: type === 'debit' ? accountId : transferToId,
            toAccountId: type === 'debit' ? transferToId : accountId,
            date,
            amount: crossCurrency ? sent : amount,
            ...(crossCurrency ? { toAmount: arrived } : {}),
            notes: notes || null,
          },
        },
        onClose,
      );
      return;
    }
    const finalAmount = type === 'debit' ? -amount : amount;
    newTx.add(
      {
        kind: 'transaction',
        data: {
          accountId,
          date,
          amount: finalAmount,
          payeeId,
          payeeName,
          categoryId,
          notes: notes || null,
        },
      },
      onClose,
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add transaction" size="md">
      <AmountFields report={report}>
        <div className="space-y-5">
          {/* Debit / Credit toggle */}
          <div className="flex gap-1 bg-surface-alt rounded-lg p-1">
            <button
              type="button"
              onClick={() => setType('debit')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
                type === 'debit'
                  ? 'bg-negative-subtle text-negative ring-1 ring-negative/20'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-hover'
              }`}
            >
              <MinusCircle size={15} />
              Debit
            </button>
            <button
              type="button"
              onClick={() => setType('credit')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
                type === 'credit'
                  ? 'bg-positive-subtle text-positive ring-1 ring-positive/20'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-hover'
              }`}
            >
              <PlusCircle size={15} />
              Credit
            </button>
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor={`${fieldId}-amount`}
              className="block text-sm font-medium text-text mb-1"
            >
              Amount *
            </label>
            <CurrencyInput
              id={`${fieldId}-amount`}
              value={amount}
              onChange={setAmount}
              aria-label="Amount"
              currency={ownCurrency}
            />
          </div>

          {/* Between currencies: what the other account sees */}
          {crossCurrency && (
            <div>
              <label
                htmlFor={`${fieldId}-other-amount`}
                className="block text-sm font-medium text-text mb-1"
              >
                {type === 'debit' ? 'Amount received' : 'Amount sent'} in {otherName} (
                {otherCurrency}) *
              </label>
              <CurrencyInput
                id={`${fieldId}-other-amount`}
                value={otherAmount}
                onChange={(v) => {
                  setOtherAmount(v);
                  setOtherTyped(true);
                }}
                aria-label={`Amount in ${otherCurrency}`}
                currency={otherCurrency}
              />
              <p className="mt-1 text-xs text-text-secondary">
                {otherTyped
                  ? 'As your bank shows it.'
                  : converted?.rate
                    ? `At the rate on ${converted.date ? formatDay(converted.date) : 'that day'} (${converted.rate}). Change it to what your bank shows.`
                    : `No rate for this day: type what ${type === 'debit' ? 'arrived' : 'was sent'}.`}
              </p>
            </div>
          )}

          {/* Merchant (a transfer has none: it's named after the other account) */}
          {!transferToId && (
            <div>
              <label
                htmlFor={`${fieldId}-payee`}
                className="block text-sm font-medium text-text mb-1"
              >
                Payee *
              </label>
              <MerchantSelect
                id={`${fieldId}-payee`}
                value={{ id: payeeId, name: payeeName }}
                onChange={(v) => {
                  setPayeeId(v.id);
                  setPayeeName(v.name);
                }}
              />
            </div>
          )}

          {/* Date */}
          <DatePicker
            id={`${fieldId}-date`}
            label="Date"
            value={date}
            onChange={setDate}
            isRequired
          />

          {/* Account */}
          <div>
            <label
              htmlFor={`${fieldId}-account`}
              className="block text-sm font-medium text-text mb-1"
            >
              {accountLabel} *
            </label>
            <div ref={setAccountListHost} className="relative">
              <Combobox
                id={`${fieldId}-account`}
                aria-label={accountLabel}
                placeholder="Select account..."
                items={accountGroups}
                value={accountId}
                // The field is never emptied: text that matches no account returns to the chosen one
                onChange={(id) => {
                  if (id) chooseAccount(id);
                }}
                menuTrigger="focus"
                footer={
                  !cashAccount && !transferToId && canSave ? (
                    <button
                      type="button"
                      // Focus stays in the field, so the list is still the field's own
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void chooseCash()}
                      disabled={switching}
                      className="w-full text-left px-3 py-2 text-sm text-brand-600 hover:bg-hover cursor-pointer disabled:cursor-default disabled:text-text-disabled disabled:hover:bg-transparent"
                    >
                      Cash (create)
                    </button>
                  ) : undefined
                }
                portalContainer={accountListHost ?? undefined}
              />
            </div>
            {bankFed && (
              <p
                role="status"
                className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-caution"
              >
                <span>
                  {selectedAccount!.name} is linked to your bank. A transaction added by hand will
                  make it disagree with the bank.
                </span>
                <button
                  type="button"
                  onClick={() => void chooseCash()}
                  disabled={switching || (!canSave && !cashAccount)}
                  className="underline font-medium cursor-pointer disabled:opacity-50"
                >
                  {cashAccount ? 'Use Cash instead' : 'Use a new Cash account instead'}
                </button>
              </p>
            )}
            {accountError && (
              <p role="alert" className="mt-2 text-xs text-negative">
                {accountError}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor={`${fieldId}-category`}
              className="block text-sm font-medium text-text mb-1"
            >
              Category
            </label>
            <CategorySelectButton
              id={`${fieldId}-category`}
              value={categoryId}
              onChange={setCategoryId}
              position="above"
              transferAccounts={transferAccounts}
            />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor={`${fieldId}-notes`}
              className="block text-sm font-medium text-text mb-1"
            >
              Notes
            </label>
            <Input
              id={`${fieldId}-notes`}
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note..."
            />
          </div>

          {/* Footer */}
          <SavedOnDeviceHint className="text-right" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="md"
              onClick={handleSubmit}
              disabled={!isValid || newTx.pending || !newTx.allowed}
            >
              {newTx.pending ? 'Adding...' : newTx.onDevice ? 'Save on device' : 'Add transaction'}
            </Button>
          </div>
        </div>
      </AmountFields>
    </Modal>
  );
}
