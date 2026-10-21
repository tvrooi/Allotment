# Category targets (phase 6D)

Implementation: `0.2.0-up.15` feature branch. Release publication and live installation are separate delivery gates.

Open a category's detail page (select its activity amount on the budget) and use **Target**. Each
expense category can have one target. Income categories and credit-card payment reserves
cannot. A target only **suggests** funding; it never assigns money. Removing a target keeps
every assignment.

| Target            | Needs in a month                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Monthly amount    | The same amount every month.                                                                       |
| Balance by date   | What is still missing, divided over the months left through the due month (inclusive), rounded up. |
| Recurring bill    | Like balance by date, toward the next due date; repeats every N months.                            |
| Refill to balance | Whatever tops the balance carried into the month back up to the amount.                            |

Requirements use the balance carried into the viewed month from the shared envelope service
(assignments, spending, money moves and card reserves). For example, $1,200 due in six
remaining months with $300 already reserved needs $150 a month. If a month is skipped, the
remaining months need more ($180 over five months). Catch-up is the part above the even
monthly rate for the whole target (or one cycle of a recurring bill).

Recurring due dates advance by whole cycles to the first due date in or after the viewed month;
nothing is rewritten, so past activity and reserved balances stay as they were. A due day that a
month lacks (the 31st) falls back to that month's last day. A balance-by-date target needs
nothing after its due month and shows **Target date passed**.

The deadline arithmetic is shared with payday plans' **Target by date** and the forecast's goal
contributions (`server/src/services/fundingMath.ts`), so a deadline means the same everywhere.
Payday plans fund per payday; category targets measure per month.

## Funding targets

Budget rows show what each target still needs this month. **Fund targets** previews an assignment
for each underfunded target in budget order, capped at money unassigned today; expected income is
never counted. Shortfalls stay visible. **Apply** adds exactly the previewed amounts to the month
in one transaction, through the same guard as manual assignments. If anything changed since the
preview, or the same preview is sent again, nothing is assigned and you review it again.

## Related budget changes

- **Monthly average** in the history popover and sheet now divides by every month in its window,
  including months with no spending: one $600 expense in six months averages $100.
- **Use for the next 12 months** now lists every month it would overwrite (current → new) before
  anything is saved. The change applies only if those months still hold the reviewed amounts.

Targets are in backup format 10. Older backups restore without targets; restore rejects targets on
missing, income or card-reserve categories and malformed definitions.
