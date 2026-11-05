# Linking a partner's own payments to household entries

Status: **design only, 5 November 2026; approach B chosen. Nothing is built.** It answers HANDOVER open item 11
(owner's note of 3 November) and waits on the decisions at the end. No code, migration or version
change comes with this page.

## The problem

Today a household entry links to a bank payment by `household_events.transaction_id`, a unique
foreign key to the `transactions` table of the **same budget**. That is right while one person keeps
the household: they record "Alex paid $90 for groceries" with Alex as payer and no bank payment,
because Alex's bank payment is not in their budget.

Once Alex has their own Allotment (multi-user mode, `docs/MULTI-USER-PLAN.md`), Alex's payment is
in Alex's budget. Three things go wrong:

1. **The entry cannot say which payment paid it.** It has no bank link, so Alex's side shows nothing
   for it, and the combined register (`gateway/sharing.ts`) shows it without a merchant or logo.
2. **Alex can record the same expense again** in their own household from their payment
   (**Share with household**). The combined register only flags a possible duplicate (same day,
   same amount, one on each side); it cannot say they are the same.
3. **Alex's reports are wrong.** Their payment is an ordinary expense in their categories, with
   nothing telling them that other people owe them a share (the owner's side has I-8,
   `RepaymentCategoryOffers`, for the mirror case).

The same applies to **repayments**: when you record "Alex repaid you" or "You repaid Alex", the leg
in the other person's bank has no link. (SPL-02, in progress in PR 149, matches only the owner's
own legs and adds no table.)

## What exists to build on

- Each person's household is their own ledger in their own budget. Combining is a view built by the
  gateway from each budget's `GET /households/:id/shared-export`; "nothing is copied between
  budgets", and either person can end it (`docs/HOUSEHOLDS.md`, "Combining with another person").
- Each person edits only their own entries. Only one thing crosses: the shared note per entry,
  kept in the gateway's `people.db`.
- The shared export deliberately leaves out accounts, categories, transaction notes, bank balances
  and pool cash. It shows a merchant name and logo for a linked payment, nothing more.
- One write path: `householdService.sharePayments` (with `preview`). Links to bank payments are
  checked there (amount, date, direction, a payment or transfer leg linked once).

## Options

**A. Do nothing structural: each person records only their own payments.** Alex records what Alex
pays in Alex's household; the owner records what the owner pays. Combined balances already add up.
Cost: the owner can never enter "Alex paid" without the risk of a duplicate, and people will
want to, because they see the bill before Alex's bank does. Needs discipline, which is what the
note asks us not to depend on.

**B. A claim in the partner's budget (recommended).** The owner's entry stays where it is, in the
owner's ledger, with Alex as payer. Alex's budget is offered it and Alex **claims** it with one of
Alex's own payments. The claim is a small row in Alex's budget:
`household_entry_claims(id, group_id, owner_id, owner_event_id, transaction_id unique, claimed_at)`,
with no money in it. The ledger on both sides is unchanged, so balances cannot move or double.

- The gateway composes the combined register as it does now, and adds each claimed entry's
  merchant and logo from Alex's side, so it reads "from bank" with the right payee.
- A claimed duplicate is no longer a "possible duplicate"; the claim is the answer.
- Alex's transaction is marked as claimed (as a household badge today), so **Share with
  household** refuses it and the claim cannot be made twice (`transaction_id` unique, and a check
  against `household_events.transaction_id`).
- Alex's reports can use the claim for the I-8 mirror: "your payment covered Sam's and Alex's
  shares, the rest is owed to you".

**C. Copy the entry into the partner's household with the link.** Alex's budget gets its own event
for the same expense, linked to Alex's payment, and the owner's copy is hidden in the combined
view. Simple to read, but two ledgers then hold one expense: edits and removals on one side must
reach the other, which breaks "each person edits only their own entries" and "nothing is
copied". Not recommended.

**D. One shared ledger owned by one budget, the other budget links by remote id.** Needs
cross-budget writes through the gateway. Not recommended: it gives up the isolation that
multi-user mode is built on.

## How B would work

### Finding the match (suggested, never guessed)

When Alex opens their Household page in a combined household, **Claim** lists the owner's entries
where Alex is payer (expenses), or the recipient or payer of a settlement, that have no claim. For
each, Alex's budget suggests payments with the amount equal, date within 3 days, in a personal
account, not transfer-linked, not already shared or claimed, and a payee that does not contradict
the entry's description (the same test as `services/importDuplicates.ts`, `matchExistingRows`;
reuse it, do not write another). Alex picks one, or **Not mine** to dismiss it, or leaves it.
Nothing is linked without a press. Settlements follow the SPL-02 rule: money out within what is
owed.

### What the owner sees

The entry in the combined register shows the payee and logo, "Alex's payment". The owner's own view
of their own household gains the badge **Linked on Alex's side** for it. They cannot claim or
unclaim on Alex's behalf. If Alex removes the claim, the badge goes and the entry is unchanged.

### Where it lives

- The claim row is in the partner's budget (backed up, `BACKUP_TABLES`, restored with older
  backups lacking it). `owner_id` and `owner_event_id` are the identifiers the gateway already
  uses (`${ownerId}:${eventId}`), so it needs no new gateway table.
- A new route on the partner's budget for suggestions, claim and unclaim. Writes go through a
  service next to `householdService`, in one DB transaction, and a claimed payment is guarded
  against edits that would break it, as a linked payment is now (amount, date, account, split,
  transfer structure).
- The gateway adds the claims to each side's shared export; the shared export is the only place
  that crosses, and it grows only by the claimed payment's merchant name and logo.
- It stays in `/api/households` and not on the token allowlist: read-only and assistant tokens
  never reach a claim (they belong to one budget, as for the combined register).

### When things end or change

- **Stop combining:** the other person's view ends, as now. The claim stays in the claimant's
  budget but is hidden, and returns if they combine again with the same people (its keys are
  stable). Owner decision on whether to delete on stop is below.
- **Owner removes or changes the entry:** the claim shows "Alex's entry changed or was removed".
  Alex's payment keeps its own data; nothing is erased. A changed amount or date needs Alex to
  claim again.
- **Alex deletes or the bank removes the payment:** the claim goes with it and the owner's entry is
  an unlinked "Alex paid" again, with a note for review (as a synced removal does today).
- **Restoring an older backup** with no claims works; claims referencing entries that no longer
  exist are shown as stale and can be cleared.

### Tests it would need

Server: a claim round trip over two budgets; refusal of an already shared or claimed payment; amount
and date mismatch; a payment on a pool account; a transfer leg; the stop-combining case; an older
backup restore; and the allowed and nearest-refusal pair for who may claim (only the budget's own
person, never the entry's owner). A property test for the match rule (each payment claimed once,
nearest day first). E2E: two signed-in people in a combined household, the claim, then both
registers.

## Decisions for the owner

**Answered 5 November 2026:** 1 is B (a claim row in the partner's budget); 2 is anyone; 3 is
settlements as well as expenses; 6 is kept hidden. **Still open** (the recommendation stands until
the owner says otherwise): 4, 5, 7, 8 and 9.

1. **Which option?** B (a claim row in the partner's budget) is recommended. A is the cheapest and
   what happens if nothing is built.
2. **Who may enter "Alex paid" once Alex has their own Allotment?** Anyone (as now), with the
   claim joining later, or only Alex (the owner would be told to wait)? Recommendation: anyone,
   since the owner often sees the bill first.
3. **Settlements too, or only expenses?** Recommendation: both, in one change; they use the same
   matching, and settlements are where people most often forget.
4. **What does the owner see of Alex's payment?** Recommendation: payee name and logo only, as
   linked payments show today. More (account, category, bank balance) is not recommended.
5. **Can the owner see that an entry is unclaimed?** Recommendation: yes, a quiet "not matched yet
   on Alex's side" in the combined register, with no nagging or notification to Alex.
6. **On Stop combining, should claims be deleted or kept hidden?** Recommendation: kept hidden, so
   combining again restores them; deleted claims cannot be restored.
7. **Alex's own category treatment.** Do we also build the I-8 mirror (Alex's payment categorised
   once, with the owner's and others' shares shown as owed to Alex)? Recommendation: a later
   change, not this one.
8. **Order of work.** This design says no code before the Spliit items it touches. Recommendation:
   build it after SPL-03/SPL-04 (in-place edits and an activity log), because an edit to a claimed
   entry needs the "changed, claim again" rule, and so the claim row's design then settles.
9. **A partner who never joins.** Everything above is optional and silent for a household whose
   other person has no Allotment; confirm that no setting is needed for that.
