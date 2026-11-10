---
name: Allotment
description: Every dollar gets its plot.
colors:
  brand-50: '#fff4ee'
  brand-100: '#ffe9de'
  brand-200: '#ffd7c4'
  brand-300: '#f48d68'
  brand-500: '#f46b35'
  brand-600: '#bf3e00'
  brand-700: '#9f3300'
  brand-800: '#592c1d'
  brand-contrast: '#ffffff'
  page: '#f7f5ef'
  surface: '#ffffff'
  surface-alt: '#efece9'
  hover: '#eeebe8'
  border: '#e4e1de'
  border-light: '#efece9'
  text: '#262520'
  text-secondary: '#5f5d5b'
  text-tertiary: '#696765'
  text-disabled: '#8f8c8a'
  semantic-contrast: '#ffffff'
  positive: '#1b7550'
  positive-subtle: '#e6f6eb'
  negative: '#cb2b30'
  negative-subtle: '#feebec'
  caution: '#9a5a00'
  caution-subtle: '#fff7c2'
  expected: '#696765'
  sidebar-bg: '#f7f5ef'
  sidebar-deep: '#ebe8e5'
  sidebar-hover: '#ebe8e5'
  sidebar-active: '#e4e1de'
  sidebar-border: '#e4e1de'
  sidebar-text: '#5f5d5b'
  sidebar-text-hi: '#262520'
  chart-account-investments: '#637b9c'
  chart-account-property: '#9a7a43'
  chart-account-other: '#907565'
  chart-account-loans: '#a66e50'
  chart-account-other-debt: '#a86269'
  chart-brand: '#487a78'
  chart-brand-light: '#68908c'
  chart-brand-subtle: '#dceae6'
  chart-brand-fill: '#eff5f2'
  chart-positive-light: '#699377'
  chart-negative-light: '#c77c71'
  chart-grid: '#efece9'
  chart-axis: '#696765'
  chart-tooltip-bg: '#ffffff'
  chart-tooltip-border: '#e4e1de'
  chart-label: '#5f5d5b'
  invest-bg: '#efe9f3'
  invest-text: '#78548d'
  dark-brand-50: '#3a2318'
  dark-brand-100: '#4a2a1c'
  dark-brand-200: '#6b3a22'
  dark-brand-300: '#c9582a'
  dark-brand-500: '#f46b35'
  dark-brand-600: '#ff8a57'
  dark-brand-700: '#ffa57e'
  dark-brand-800: '#ffc4a6'
  dark-brand-contrast: '#22201d'
  dark-page: '#1c1a17'
  dark-surface: '#262320'
  dark-surface-alt: '#302c28'
  dark-hover: '#3a3531'
  dark-border: '#4a443e'
  dark-border-light: '#3a3531'
  dark-text: '#f4f1ec'
  dark-text-secondary: '#c9c3bb'
  dark-text-tertiary: '#aaa39a'
  dark-text-disabled: '#766f67'
  dark-semantic-contrast: '#22201d'
  dark-positive: '#6cc695'
  dark-positive-subtle: '#1f3a2c'
  dark-negative: '#ff8f8c'
  dark-negative-subtle: '#44262a'
  dark-caution: '#f0b955'
  dark-caution-subtle: '#3f3219'
  dark-expected: '#aaa39a'
  dark-sidebar-bg: '#211e1b'
  dark-sidebar-deep: '#1c1a17'
  dark-sidebar-hover: '#2f2a26'
  dark-sidebar-active: '#3d352f'
  dark-sidebar-border: '#38322d'
  dark-sidebar-text: '#c9c3bb'
  dark-sidebar-text-hi: '#f4f1ec'
  dark-chart-account-investments: '#9baec7'
  dark-chart-account-property: '#c3aa7a'
  dark-chart-account-other: '#bca99a'
  dark-chart-account-loans: '#c99574'
  dark-chart-account-other-debt: '#cf9ba1'
  dark-chart-brand: '#92bdb4'
  dark-chart-brand-light: '#b2d1c8'
  dark-chart-brand-subtle: '#304540'
  dark-chart-brand-fill: '#283630'
  dark-chart-positive-light: '#b6d7bd'
  dark-chart-negative-light: '#f1bcb0'
  dark-chart-grid: '#302c28'
  dark-chart-axis: '#aaa39a'
  dark-chart-tooltip-bg: '#302c28'
  dark-chart-tooltip-border: '#4a443e'
  dark-chart-label: '#c9c3bb'
  dark-invest-bg: '#382d40'
  dark-invest-text: '#d0b3de'
typography:
  title:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.75rem'
    fontWeight: 500
    lineHeight: '2.25rem'
    letterSpacing: '-0.025em'
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: '1.5rem'
    letterSpacing: '0em'
  label:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 500
    lineHeight: '1.25rem'
    letterSpacing: '0em'
  nav:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 400
    lineHeight: '1.25rem'
    letterSpacing: '0em'
  row:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: '1.25rem'
    letterSpacing: '0em'
  2xs:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.6875rem'
    fontWeight: 400
    lineHeight: '1rem'
    letterSpacing: '0em'
rounded:
  sm: '6px'
  md: '10px'
  lg: '12px'
  xl: '20px'
  full: '9999px'
spacing:
  1: '4px'
  2: '8px'
  3: '12px'
  4: '16px'
  5: '20px'
  6: '24px'
components:
  button-primary:
    backgroundColor: '{colors.brand-600}'
    textColor: '{colors.brand-contrast}'
    rounded: '{rounded.full}'
    padding: '0 16px'
  button-primary-hover:
    backgroundColor: '{colors.brand-700}'
    textColor: '{colors.brand-contrast}'
    rounded: '{rounded.full}'
    padding: '0 16px'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-secondary}'
    rounded: '{rounded.full}'
    padding: '0 16px'
  button-ghost:
    textColor: '{colors.text-secondary}'
    rounded: '{rounded.full}'
    padding: '0 16px'
  button-danger:
    backgroundColor: '{colors.negative}'
    textColor: '{colors.semantic-contrast}'
    rounded: '{rounded.full}'
    padding: '0 16px'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: '0 12px'
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.lg}'
    padding: '24px'
  badge-positive:
    backgroundColor: '{colors.positive-subtle}'
    textColor: '{colors.positive}'
    rounded: '{rounded.full}'
    padding: '2px 8px'
  nav-active:
    backgroundColor: '{colors.sidebar-active}'
    textColor: '{colors.sidebar-text-hi}'
    rounded: '{rounded.md}'
    padding: '8px 12px'
---

# Design System: Allotment

## Overview

**Creative North Star: "The Tended Ledger"**

The Tended Ledger is warm, orderly and quietly practical. Canvas backgrounds and Soil text frame dense financial information; Marigold guides action and Sprout communicates positive outcomes. Garden cues live in the established identity rather than additional interface ornament.

Components are gentle and precise. Rounded cards, pill buttons and compact forms keep the workspace approachable, while aligned amounts and explicit state treatments support careful budgeting. Depth is softly layered rather than dramatic.

**Key Characteristics:**

- Warm neutral foundations
- Precise financial hierarchy
- Gentle rounded controls
- Softly layered surfaces
- Responsive desktop and mobile web

This is a record of the incumbent system, not a redesign. Sources are `client/src/index.css`, shared components in `client/src/components/ui/`, `Sidebar.tsx`, `AppShell.tsx` and `docs/BRAND.md`. The mobile dashboard was visually inspected and its computed styles sampled. Dark values were extracted from code; dark-mode visual verification was not performed in this pass. Tokens here are an extracted snapshot; update this record and its sidecar when the source system changes.

## Colors

### Primary

**Marigold** is the brand accent (`brand-500`). Filled actions and orange text use the darker `brand-600`, with `brand-700` for hover and `brand-contrast` for the foreground. The dark theme changes those roles together; do not carry a light-theme foreground into dark mode.

### Neutral

**Canvas** (`page`) provides the warm page foundation; **Soil** (`text`) anchors readable content. White `surface` cards sit above it, with `surface-alt`, `hover` and fine borders separating adjacent regions. Secondary and tertiary text support hierarchy; disabled text is reserved for unavailable states. Sidebar roles remain distinct tokens even where their values match page tokens.

### Semantic and data colors

**Sprout** (`positive`) marks positive financial values and savings states. Negative and caution roles have paired subtle fills. `expected` is neutral: a scheduled debit that is covered is not an error. Muted teal chart-brand colors support data without turning every chart into a primary action. Investment badges use their dedicated background and text pair.

**The Semantic Pair Rule.** Use each state foreground with its matching subtle background or contrast token; preserve its theme override.

Light roles are the unprefixed frontmatter entries. `dark-` entries document the corresponding `.dark` overrides; runtime code continues using the same unprefixed CSS variable names. The brand guide retains its established color names.

## Typography

Inter is the declared display and body family, with UI sans-serif, system-ui and sans-serif fallbacks. `client/src/main.tsx` imports bundled Inter weights 400, 500, 600 and 700 through @fontsource; the system stack remains the fallback.

- Page titles: title role, medium weight, tight tracking; shared PageHeader reduces to 24px/32px below the medium breakpoint.
- Body: 16px/24px regular; compact forms and buttons use 14px/20px.
- Sidebar rows: the current NavItem uses 14px/20px medium on desktop and the row role on phones. The nav token is also available for compact menus.
- Small metadata: 12px/16px; the 2xs role is for the smallest labels and counters.
- Summary amounts: 20px/28px semibold, tight tracking and tabular numerals. Amounts do not wrap inside their digits.

The dashboard's introductory heading is a contextual exception: the inspected mobile screen uses 20px/28px medium secondary text rather than the shared page-title treatment. Do not force a display hierarchy onto every summary sentence.

**The Whole-Pixel Rhythm Rule.** Use the named intermediate text roles rather than bare arbitrary sizes with fractional inherited line heights.

## Layout

The desktop shell is a fixed-height flex layout with a persistent sidebar and scrolling content. The sidebar is 232px wide, or a 64px auto-hide rail; macOS window variants use 246px and 92px respectively. Preserve title drag regions and safe-area padding.

At the medium breakpoint (768px), phone layouts use a top bar and navigation drawer. Shared page headers have 24px horizontal padding on desktop and 16px on phones. Cards default to 24px padding, reducing to 16px on phones. The rhythm primarily follows 4px increments, with 8–16px gaps between controls and tiles.

Summary grids wrap from two columns to three or four on wide layouts (the shared grid uses the large breakpoint, 1024px). A tile whose unbroken amount needs more space takes its own row. Main content must remain usable at 390px without page-level sideways scroll; tab rows may scroll horizontally within their own container.

Buttons and inputs are 40px high by default and at least 44px on phones; small buttons are 32px on desktop. Mobile text inputs, selects and textareas are at least 16px to avoid iOS focus zoom.

## Elevation & Depth

Softly layered: warm tonal separation, fine borders and restrained shadows define cards. Stronger shadows distinguish overlays. Use the existing shadow variables rather than inventing a parallel elevation scale.

- `shadow-xs`: filled buttons and small controls.
- `shadow-card`: resting cards.
- `shadow-hover`: optional interactive card hover.
- `shadow-modal`: dialogs; the backdrop is black at 30% with a small blur.

Exact light and dark shadow values are captured in the sidecar. Dark mode uses stronger shadows against deeper warm surfaces. Sidebar auto-hide expansion additionally uses Tailwind's shadow-xl treatment.

## Shapes

Small corners use the sm radius, fields and navigation rows use md, cards and desktop dialogs use lg, and mobile sheets use xl on their top corners. Buttons and badges are fully rounded. Borders are generally 1px; optional card status accents are 3px on the left.

## Components

### Buttons

Shared Button and ButtonLink expose primary, secondary, ghost and danger variants in sm/md sizes. All variants reserve a 1px border so adjacent controls align. Medium buttons have 16px horizontal padding, small buttons 12px, and icon/label gaps are 8px. Ghost buttons are transparent until hover. Filled disabled buttons become neutral with an inset border; outlined and ghost buttons fade. Disabled controls do not accept pointer interaction.

### Inputs and selects

White/themed surfaces, md corners, 1px border and 12px horizontal padding. Focus changes the border and adds a 1px brand ring. Preserve labels, placeholder hierarchy and mobile sizing. Money entry uses the existing CurrencyInput and currency formatting utilities.

### Cards and summary tiles

Cards combine surface fill, a light border, lg corners and the card shadow. Optional hover elevation is explicitly enabled. Summary tiles use a small label, prominent tabular value and smaller supporting line; optional left accents communicate status.

### Badges

Compact full-radius pills with 8px horizontal and 2px vertical padding, 12px medium text and paired semantic colors. Account badges also include checking, credit, cash and investment roles; other account types derive a tint from their existing account icon color mapping.

### Navigation

Sidebar links have md corners, 12px horizontal and 8px vertical padding, 12px icon gaps and medium labels. Active links use sidebar-active and sidebar-text-hi; hover uses sidebar-hover. Mobile drawer links provide 44px touch targets. Preserve accessible names in collapsed navigation.

### Dialogs and motion

Desktop dialogs are centered at the shared sm/md/lg/xl widths (384/448/512/768px). On phones they become full-width bottom sheets with rounded top corners and home-indicator clearance. Keep focus trapping, opener focus restoration, Escape handling and discard prompts.

Backdrops fade in 150ms and out 120ms. Dialogs enter in 160ms with a small rise and scale; menus enter in 110ms. Sheets enter in 220ms. Reduced-motion mode replaces movement with fades. General color transitions use Tailwind transition-colors; sidebar width transitions use 200ms.

Global keyboard focus uses a 2px brand-600 outline offset by 3px; horizontally clipped tab rows draw focus inside. Fields have their own focus treatment.

## Do's and Don'ts

### Do

- Do use semantic CSS variables so light and dark themes remain coherent.
- Do reuse the shared Button, Input, Card, Badge, Modal and PageHeader components.
- Do keep money tabular and unbroken while allowing labels to wrap.
- Do retain visible keyboard focus and reduced-motion behavior.

### Don’t

- Don't substitute the bright brand-500 swatch for the accessible brand-600 control treatment.
- Don't color a covered, expected debit as a warning; use the neutral expected token.
- Don't hard-code light colors into surfaces that must support dark mode.
- Don't use uppercase headings or labels by default; uppercase sidebar group labels and small bill section labels are existing exceptions.
