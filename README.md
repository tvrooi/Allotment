<p align="center"><img src="client/public/logo.svg" alt="" width="88" /></p>

# Allotment

**Every dollar gets its plot.**

A private budgeting app with a direct connection to Up Bank. It keeps your budget on your own
computer or your own Home Assistant, with no Allotment account and no tracking.

Allotment was the FlyBudget Up fork. It is built on
[dtymoszenko/FlyBudget](https://github.com/dtymoszenko/FlyBudget) and stays AGPL-3.0-only; it is
not an official FlyBudget, Up or Home Assistant release. Existing installs keep their budget,
settings and Home Assistant app when they update ([what changed](docs/BRAND.md#renaming-from-flybudget)).

## Who it is for

Australians with an Up account who want an envelope-style budget they control. If you already run
Home Assistant, it fits there. If you do not, the desktop app works on its own.

## Install

Both routes start on one page: **[Start here](docs/START-HERE.md)**.

- **Home Assistant** (budget on every device): the [Start here](docs/START-HERE.md#track-a-home-assistant) page, Track A.
- **Mac, Windows or Linux desktop only**: the [Start here](docs/START-HERE.md#track-b-desktop-only) page, Track B.

Unsure of a word? See the [glossary](docs/GLOSSARY.md).

## What you get

- Up Bank imports of settled AUD transactions, including Savers and 2Up accounts, with Up's
  categories where they match and a quick sort step for the rest.
- Zero-based envelope budgeting, with optional fortnightly [payday plans](docs/PAYDAY-PLANS.md)
  and bill coverage.
- [Forecasts](docs/FORECASTS.md) of cash until payday and progress towards goals.
- Import from YNAB or CSV, and link Up to an account that already has history from a cut-over date.
- Optional separate budgets for each person in a household.
- Works on your phone through a browser when it runs on Home Assistant.

## Security and privacy

Your budget and your Up token stay on your own server or computer. The token is encrypted, read-only
and never included in exports. Allotment uses HTTP only on a trusted home network and never skips
certificate checks. [Report security issues privately](https://github.com/tvrooi/Allotment/security/advisories/new).
See [SECURITY.md](SECURITY.md). Never put tokens, databases or private exports in issues.

## Help and downloads

[Downloads](https://github.com/tvrooi/Allotment/releases) and
[issues](https://github.com/tvrooi/Allotment/issues) for this fork are on GitHub. Changes and
development: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence and upstream credit

Original application and copyright: [dtymoszenko/FlyBudget](https://github.com/dtymoszenko/FlyBudget).
The [upstream README](docs/UPSTREAM-README.md) is kept for reference; its download links and
contribution rules describe upstream. All original notices and the
[AGPL-3.0-only licence](LICENSE) are retained. Modified source is public here and linked from the
app. This fork does not require or accept the upstream CLA on your behalf.
