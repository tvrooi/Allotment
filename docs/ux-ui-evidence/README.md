# Allotment audit evidence

Companion to [the UI/UX audit](../UX-UI-AUDIT.md), baseline `99021a5944006e3e968a169aeaf02ecddc342125`, 7 November 2026. All budgets, bank services and uploaded documents are demo or synthetic. No production account was connected.

## Reading the evidence

- PNG names identify the route/surface, viewport width and state. Desktop captures use 1440×900; mobile uses 390×844; narrow captures use 320×844. Full-page images can be taller than the viewport.
- Adjacent TXT files contain rendered page text. Trailing whitespace is normalised in text captures and test logs. JSON records contain URLs, measurements or interaction results. Contact sheets are navigation aids; use original images for close inspection.
- `demo` is the in-browser seeded budget; `empty` is a disposable real server; `synthetic` is a populated disposable real server. `dark` uses browser colour-scheme emulation. No screenshot establishes native Electron, actual Home Assistant or physical-phone testing.
- Initial `welcome-*-demo` captures redirect to Dashboard. Use `welcome-*-empty`. Use `dashboard-*-settled` instead of the initially loading desktop capture. `transactions-tab-receipts-*` used an incorrect query parameter; use `receipts-*`.
- Discovery logs retain failed selectors. A script looking for a button when the product correctly exposes a tab is not an application defect.
- `SURFACES.md` is a source-discovery register, not a claim that every listed instance was exercised. The report's coverage and continuation tables are authoritative.

## Reproduction

Follow the repository setup and demo instructions at the audited commit. Install client/server/e2e dependencies with their lockfiles and keep install scripts disabled. Build and serve the demo on localhost:5173. The preserved `capture.cjs` and `interact.cjs` scripts use the original cloud paths (`/workspace/Allotment`, Chromium `/usr/bin/chromium`); adapt paths before running elsewhere and use a fresh output directory to preserve this evidence. The initial capture script deliberately records early state and must be followed by settled-state checks, as this audit did.

For browser regressions, use the repository e2e runner with `E2E_CHROMIUM_PATH=/usr/bin/chromium`. The three `journeys-*.log` files retain exact test names, projects and results. Their fixtures create disposable databases and mock bank services. Do not point them at a live server. Desktop test defaults are 1400×900; independent audit captures are 1440×900.

Failure probes in `defects.json`, `load-errors.json` and `delete-failure.json` replaced the matching request response with HTTP 422 in an isolated browser tab. Reproduce the exact steps in each finding using synthetic data; a simulated refusal establishes the UI's handling of that response, not the frequency of a production outage.

## Results and limitations

176 browser tests passed (36 + 90 + 50). One plain-HTTP warning test was blocked before the app loaded by the cloud proxy rejecting the test hostname. Its subsequent serial lockout test did not run. See `journeys-second.log` and `http-warning-test-failure.png`; neither result is represented as a product defect or a pass.

The 42 axe-core scans reported zero automatic violations in the sampled states. They left 207 node/rule occurrences requiring manual review (color-contrast: 172, th-has-data-cells: 2, aria-prohibited-attr: 33); occurrences may repeat the same component across routes. These are unresolved checks, not passes, and do not negate the independently reproduced modal keyboard defect.

The axe scanner used a separate browser context with CSP bypass solely for injection. Application CSP was unchanged. Token contrast results cover seven sampled pairs in each theme, not all rendered combinations. The report records independent keyboard findings, remaining assistive-technology checks, deployment gaps and proposed user-validation tasks.
