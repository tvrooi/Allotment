# Allotment brand

Allotment is the name of this app, formerly the FlyBudget Up fork. An allotment is a piece of
ground you tend with intention; the app gives each dollar a place and a purpose.

- **Tagline:** Every dollar gets its plot.
- **Voice:** clear words, warm encouragement, one next step. "Give every dollar a job. Make room to grow."

## Mark and colours

Three garden plots and a sprout. The app icon puts the mark in Canvas on a Soil tile, with one
plot in Marigold and the sprout in Sprout green.

| Name     | Hex       | Use                                                              |
| -------- | --------- | ---------------------------------------------------------------- |
| Soil     | `#262520` | Text, icon tile                                                  |
| Marigold | `#F46B35` | The one bright spot: brand accent (`--color-brand-500`)          |
| Canvas   | `#F7F5EF` | Page background (`--color-page`), plots on the icon tile         |
| Sprout   | `#1B7550` | The icon's sprout; the app's positive green (`--color-positive`) |

Filled controls and orange text keep the darker `--color-brand-600` so they stay readable.

Sources (SVG; the PNG and ICO files are renders of them):

- `client/public/logo.svg` → `client/public/logo.png` (web app, favicon, Home Assistant icon)
- `electron/resources/icon.svg` → `icon.png` (256 px) and `icon.ico` (16–256 px)
- `electron/resources/icon-1024.svg` → `icon-1024.png` (macOS and Linux, with the macOS margin)

The wordmark is `client/src/components/ui/BrandName.tsx`: one bold word, set tight.

## Renaming from FlyBudget

Only what people see changed. Identifiers that existing installs depend on keep the old name:

- `FLYBUDGET_*` environment variables, cookies (`flybudget_session`, …), `x-flybudget-*` headers,
  browser storage keys and data paths (`/data/flybudget`, `flybudget_data_key.txt`).
- The Home Assistant app slug `flybudget_up`, so the installed app updates in place, and the
  container images `ghcr.io/tvrooi/flybudget` and `flybudget-ha`.
- The desktop app's internal name, FlyBudget (`electron/main.ts`): its local budget, credentials key
  and keychain entry stay where they are. Its bundle, menus and windows say Allotment. The Windows
  app ID `com.flybudget.app` and the Linux package and command `flybudget` are unchanged, so new
  installers upgrade the old app rather than install beside it.
- `FlyBudgetMacWindow/1` and the `flybudget-mac-window` marker, which servers and desktop apps of
  different versions exchange.

The repository moved from `tvrooi/FlyBudget` to `tvrooi/Allotment`; GitHub redirects the old address.
Desktop apps from before the rename check `tvrooi/FlyBudget` for updates with redirects turned off,
so they cannot find newer releases by themselves. Install the next release once by hand from the
[Releases page](https://github.com/tvrooi/Allotment/releases); later updates are found again.

The user guide links still point at the upstream FlyBudget site, which Allotment is built on.
