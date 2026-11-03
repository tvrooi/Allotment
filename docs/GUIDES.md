# Guides and tips

In-app guides (a highlighted walkthrough, one element at a time) and one-line tips, so people
learn Allotment where they use it. User guide: `website/docs/guides.mdx`.

## Owner decisions

- Progress is **per person**, not per device: it is stored in the person's budget, which in
  multi-user mode is theirs alone (the gateway routes each signed-in person to their own budget).
- **Budgets in use before guides** get no tour, tips and page guides off, and a one-time note
  ("New: guides and tips") pointing at the **?** menu and Preferences.
- **New budgets** get the welcome tour offered once (an inline banner on the dashboard, never an
  overlay that opens by itself), with tips and page guides on. Nothing else is offered and no
  tip shows until the tour is taken or turned down.

## Server

- `guide_progress` (migration 0058): one row, id `default`. No row = a new budget. The migration
  inserts the "in use before" row when the budget has any account or transaction.
- `services/guideService.ts`, `routes/guides.ts` at `/api/guides`: `GET`, `PUT` (a partial
  update; `seenGuides` keeps the highest version per guide and `dismissedTips` is a union, so two
  devices can't undo each other; `guidesNotice` can only be cleared), `POST /reset` (clears seen
  guides and tips and offers the tour again, keeping the on/off settings).
- Presentation only: never in backups (restoring doesn't change it) and not on the access-token
  allowlist (`auth/accessTokens.ts`). Mounted in the in-browser demo too.

## Client

- Guides are data: `client/src/guides/` (`welcome.ts`, `budget.ts`, `tips.ts`). A step names a
  `data-guide` marker (or several; the first one visible wins), an optional route to open first,
  and an optional `phoneBody` for when the element sits in the closed phone menu. Never rename a
  guide or tip id: they are stored. Raise a guide's `version` to offer it again as updated.
- `utils/guides.test.ts` checks every marker a guide names exists in the source, so renaming a
  component can't silently break a guide.
- `utils/guides.ts`: which banner shows (`bannerFor`), tip visibility, card placement and the
  optimistic merge (mirrors the server).
- `components/guide/`: `GuideTour` (dims the screen, highlights the element, makes `#root`
  inert while open, traps focus, Escape/arrows, phone bottom or top sheet, waits up to 3 s for a
  page's element and goes on without it), `GuideBanner` (inline, above the page), `Tip` (inline,
  one per page via `store/guideStore.ts`), `HelpMenu` (the sidebar's **?**), `GuidesDialog`
  (every guide, plus `GuideSettings`, also in Settings → Preferences). `?` opens the list
  (`hooks/useGuideKeyboard.ts`).
- When the server is unreachable or older (no `/api/guides`), nothing is offered and no tip shows.

## Adding a guide or tip

1. Put `data-guide="<page>.<thing>"` on the element (a stable element, present on desktop and
   phone where possible).
2. Add the guide to `client/src/guides/` and `GUIDES` in `guides/index.ts`; give it `page` to
   offer it on that page and list it under **Guide for this page**.
3. For a tip, add it to `guides/tips.ts` and render `<Tip tip={TIPS.x} />` in the page's flow.
   Keyboard-shortcut tips take `desktopOnly`.
4. Only describe what the app really does; check the page.

## Testing

Unit: `npm test --prefix client -- guides`, `npm test --prefix server -- guides`. Browser:
`e2e/tests/guides.spec.ts` and `e2e/tests/phone/guides-phone.spec.ts`. The e2e database reset
doesn't touch guide progress, so those specs put it back to a new budget's afterwards.

## Page guides

Every main page has a guide (`guides/budget.ts`, `guides/pages.ts`): Budget, Accounts,
Transactions, Rules, Recurring, Review, Pay later, Household, Goals, Forecast, Investments, Tax
time, Reports and Settings (which covers connecting Up). Tips: Dashboard (Safe mode shortcut),
Transactions (undo), Budget (carry forward), Payees (default category).

A step whose element needs data a new budget doesn't have (an Afterpay account, an investment
account, a household) shows in the middle of the screen. `GuideTour` sets `data-target`
(`searching`, `found`, `missing`) on its overlay; `guides.spec.ts` walks every page guide and
checks each step finds its element, and the phone spec walks them all on a phone.
