# Monarch Forecasting: controlled scenario reconstruction

22 October 2026. Live REA observations from an explicitly authorized, separate synthetic scenario. This extends the [initial Forecasting notebook](monarch-observed-workflows.md). Observed controls and sample results are distinct from derived formulas; no proprietary source or full financial model has been recovered.

## Inspection boundary and retained artifacts

The user authorized labeled synthetic data and a separate test scenario. Duplicating the baseline immediately created a copy, then opened a name/icon dialog. The copy was renamed **REA INSPECTION — synthetic forecast**. The baseline was not edited. Duplication evidence: `ev_a30f6896315179eba8642233b4d9410bc06a1845c69c2318758f6163620b5218`.

The retained test scenario contains six newly created events: Home, New job, Child, Career break, Income and Windfall. It also contains copied Retirement, Social Security and End of plan events. The Income event was saved as a zero-dollar one-time event. The savings allocation test's two 50% settings were saved only in this test scenario. No deletion permission had been given at this checkpoint, so the scenario and its events were retained. This inventory intentionally omits account URLs and identifiers.

Opening an event template is an immediate persistence boundary: the event is created before its amount has been completed. New job visibly changed the forecast on opening because its defaults reduced an existing income source by 100% while new take-home income was still zero. An empty amount therefore does not imply an inert event.

## Scenario comparison

Evidence: `ev_a2794ec4722ed36a52e10a928c06e96e348eeee126c3fa5c02c1b48a340b1d1d`.

**Observed:** a Compare selector appeared once two scenarios existed. Comparing the active synthetic scenario against baseline displayed a solid black active line, a dashed gray baseline line, a legend and event icons for both scenarios. KPI summaries showed paired values, colored absolute/percentage differences and No change where applicable. A table toggle selected active versus baseline data, and Dismiss comparison removed the comparison.

One displayed comparison had an active value around 772.5K and baseline around 3.57M, with a red decrease around 2.80M (363%). The displayed percentage appears to use the active value as denominator. Rounded UI numbers prevent exact reconstruction. Do not assume standard change relative to baseline, and do not copy this percentage convention into FlyBudget without an explicit definition.

**Intent, inferred:** the overlay exposes consequences of assumptions against a reference plan; paired KPIs locate meaningful checkpoints. Table switching provides a way to inspect each plan's components without implying that the table itself displays deltas.

## Home purchase event

Evidence: `ev_919bbc858e634a846c00c81797da1668a1d35178b5fdb552e972ec5f52a72106`.

**Observed:** the editor offers finance/cash purchase modes. The inspected financed default uses a 400,000 purchase amount in today's dollars, 80,000 down payment (20%), a 30-year mortgage at 6.5%, property tax at 1%, and insurance at 0.5%. Estimated monthly payment is 2,522.62, broken into principal/interest 2,022.62, property tax 333.33 and insurance 166.67.

Yearly ownership costs are 4,000 (1%), with escalation set to match inflation. Replace existing housing costs is unchecked; its current monthly amount is zero. The explanation says the existing housing cost is replaced by the estimated payment when this option is used. The event adds property and mortgage rows to the Accounts projection.

**Derived check, not recovered code:** conventional level-payment amortization matches the sample's principal/interest estimate. With principal `L = 400000 - 80000`, monthly rate `r = 0.065 / 12` and `n = 360`, payment is `L × r / (1 - (1 + r)^(-n))`, approximately 2,022.62. Annual percentage tax and insurance divided by 12 match the displayed 333.33 and 166.67. This single sample does not establish compounding/rounding conventions elsewhere, event-year timing, refinancing, appreciation, sale proceeds or ownership-cost cashflow timing.

## Income-changing events and overlapping effects

### New job

Evidence: `ev_3587764dfdf2d39c07e2ce240cf3632182c621dc3ecd35a126a6e1a36e4ae8ec`.

**Observed:** fields include year/age, yearly take-home income defaulting to zero, escalation and signing bonus defaulting to zero. Per-source income reduction defaults to 100%. An overlap explanation shows Also reduced by Retirement 100%. Opening this event saves it and drops the curve before income has been entered.

**Intent, inferred:** the event can replace a prior income source while introducing new income and an initial bonus. The overlap explanation makes other events affecting that source visible. Exact combination rules for two simultaneous reductions were not established.

### Career break

Evidence: `ev_d9ab9f95362a807472e2a15ced8ac3765f05860cc52178bcc5b7913154076098`.

**Observed:** the inspected start/end years are 2041/2042, labeled one year. A spending multiplier slider shows Same. Per-source income reduction is zero; an overlap display says Also reduced by New job 100%. A second income source, New job, has a zero reduction.

This exposes both a bounded event interval and source-specific effects. It does not establish date inclusivity, partial-year treatment or whether reductions multiply, add or take precedence.

### Retirement copied into the test scenario

Evidence: `ev_632b92ee83439d0455ccbf69da619d122f0b1fbca8de94202eed326bb91f11fd`.

**Observed:** year/age shows age 65; spending multiplier is Same; an additional annual 6,500 healthcare allowance has escalation controls. Per-source income reductions show 100%, with overlap explanations. These are inspected values in a copied event, not universal defaults or Australian retirement assumptions.

### Income event

Evidence: `ev_4a449fbccbfc6b70848f720566ce4ee9bedb4f6019309ee84eec46ffef7ebeab`.

**Observed:** opening defaults to recurring income, annual amount zero, repeat every one year, optional end year and escalation. An affected-by list links Retirement, New job and Career break. Switching to One-time hides recurrence, escalation and the dependency list, and changes the amount label. The synthetic event was saved as One-time with amount zero.

**Intent, inferred:** recurring income exposes ongoing growth and interactions with life events, while one-time income represents an isolated inflow. Hiding dependency controls does not prove that every internal interaction is removed; only the visible form change was observed.

## Child, windfall and Social Security events

### Child

Evidence: `ev_b963962e739ccd6837b12f43a7b97ff7fd10add7bb8a728b73e4cd7caa9876ff`.

**Observed:** the editor includes year, duration (13 years in the inspected instance), annual amount 18,000, upfront amount 4,500 and escalation. Guidance says to use remaining years for an existing child and remove those expenses from living expenses to avoid double counting. The inspected duration is not established as a universal default.

### Windfall

Evidence: `ev_3bcee1839d678a98b10c5fa27474ca18ec014dc2c91b55d40b09872230bd31bd`.

**Observed:** fields include year and zero amount in today's dollars, alongside common Exclude from forecast, More options, Close sidebar and name/icon controls. Exclusion and other-menu consequences were not exercised in this supplied evidence.

### Social Security copied into the test scenario

Evidence: `ev_05f1fb31409bc551e9c80a5c3dbc17c1059c4710daf2b3527cc1f3f5e950b548`.

**Observed:** year/age shows age 65, monthly benefit is 2,000, escalation is available and a Social Security calculator link appears. This is a U.S.-specific input surface; its presence establishes neither a recovered benefit formula nor applicability to Australian superannuation.

## Savings splits: verified sequential allocation example

Editor evidence: `ev_d0f34ca78e5ba128ca643f8db176ad7ec90fa4f1122772ec51fe840bd025dcf3`. Controlled example: `ev_9078e111764a6e681753f6e12ab5b2b4492f76f9f2f55308d209baebb17419c5`.

**Observed:** savings splits contains ordered draggable accounts, with percentage or fixed-dollar allocations. Its explanation says amounts entered in today's dollars grow with inflation. Extra Savings receives the remainder. Show example exposes a 10,000 input.

The verified synthetic example used 50% on the first account and 50% on the second:

| Step                | Displayed allocation | Remaining |
| ------------------- | -------------------- | --------- |
| Initial surplus     | —                    | 10,000    |
| First account, 50%  | 5,000                | 5,000     |
| Second account, 50% | 2,500                | 2,500     |
| Extra Savings       | 2,500                | 0         |

This establishes sequential percentages of the remaining surplus in that example, rather than two percentages of the original total. Both settings were saved only in the synthetic scenario. Fixed-dollar caps, insufficient surplus, negative cashflow, reordered-account outcomes and inflation rounding were not tested.

**Intent, inferred:** order expresses allocation priority; the example reveals the meaning of each step before a user relies on the projection. An independent implementation should explain this denominator directly.

## FlyBudget implications and unresolved mechanics

These are independent proposals grounded in the observed interactions:

- Keep scenario definitions and synthetic events separate from real transactions and shared profile data. Prefer an explicit draft/Create boundary; label immediate writes and show save/error state if autosave is chosen.
- Expose each income source's active reductions and overlapping events; define combination and interval rules before implementing the calculation.
- Pair curves with component explanations, event markers and source tables. Define comparison denominators rather than reproducing ambiguous percentages.
- If adding surplus allocation, show order, remaining surplus and a worked example. Keep percentage-of-remainder distinct from percentage-of-total.
- Reuse FlyBudget's existing read-only short-term forecast where appropriate. A decades-long account/retirement/property projection requires a separately specified model, not a relabeling of liquid-cash output.

Still unverified: partial years; event collision ordering; account depletion and withdrawal behavior; fixed-dollar split boundaries; display inflation transformations across all inputs; tax treatment; mortgage event timing; market returns; comparison rounding; and exact persistence/error/recovery semantics. The observed controls and single amortization sample are insufficient to claim numerical parity.
