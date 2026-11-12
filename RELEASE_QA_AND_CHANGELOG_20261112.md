# Songa Flight Watch — 12 November 2026 integration and release handover

## Source comparison

- `Songa_FlightWatch_Milestone5_Release_Candidate_20261111_v2.zip` is the canonical editable application baseline.
- Its core `package.json`, `src/App.tsx`, `src/index.css`, `src/main.tsx`, `vite.config.ts`, and `supabase/config.toml` match the `legacy-source` copy inside `SONGA_2_0_GITHUB_READY.zip` byte-for-byte.
- `Songa_FlightWatch_Full_Source_20261111.zip` is an earlier/less normalized source snapshot with Windows-style archive paths and duplicated root-level files. It was used as a comparison reference, not as the merge base.
- The Stitch package contains 31 exported screen designs and a separate iframe-based visual host. Its host is not the production application: several UI actions only show notices or invoke an Edge Function without binding the full existing app state. Therefore its HTML mockups are preserved as design references under `public/stitch/`, while the actual React/Supabase application remains the functional shell.

## Changes in this package

- Preserved the November 11 Milestone 5 application source, Supabase migrations, Edge Functions, PayPal server-side functions, and existing auth/flight-watch flows.
- Included all Stitch screen exports as reference assets; no static mockup is substituted for a live workflow.
- Tightened the homepage hero layout and reduced decorative visual weight, especially at tablet and mobile widths.
- Added global dark-theme surface, form, navigation, card, and page-background overrides so the theme setting applies across application screens, not only the homepage.
- Improved mobile navigation visibility and contrast in both themes, touch targets, safe-area spacing, and narrow-screen overflow behavior.

## Verification status

- Source comparison completed.
- Dependency-free Milestone 2 verification script: run separately and record result below.
- TypeScript transpilation: run separately and record result below.
- `npm ci` was attempted in the packaging environment but timed out; therefore dependency-aware typecheck, ESLint, Vite production build, browser/mobile visual tests, live Supabase writes, and PayPal Sandbox transactions remain unverified here.
- No GitHub push, remote Supabase migration, Edge Function deployment, PayPal live-mode switch, or Vercel Production deployment was performed.

## Release blockers / owner actions

1. Install dependencies in a network-enabled environment and run `npm ci`, `npm run verify:milestone2`, `npm run typecheck`, `npm run lint`, and `npm run build`.
2. Test actual sign-in, flight search, watch/save/reload/remove, watchlist privacy, AI, WhatsApp linking, and all relevant commerce flows against the intended Supabase project.
3. Test PayPal Sandbox create-order, approval, capture, cancel, duplicate callback, invalid amount/currency, and entitlement/fulfilment persistence. Keep live credentials disabled until these pass.
4. Inspect and apply only reviewed pending Supabase migrations; do not reset the database.
5. Test mobile at 320px, 360px, 390px, 430px and desktop widths, both themes, and record screenshots.
6. Push this package to a new Git branch and use a Vercel Preview deployment before merging to `main`.

## Important product truth

Airside merchant fulfilment and accommodation booking remain sandbox/provider-dependent as described in the existing handover documents. A designed screen is not proof of a live integration. The Stitch mockups are design references, not evidence that their controls perform production transactions.

## 12 November final polish addendum

- Simplified the homepage travel desk from seven competing shortcuts to five primary actions; airport boards and trip workspace remain available through navigation.
- Removed the repeated four-item trust strip below the compensation CTA to reduce promotional repetition.
- Reduced hero/map/service section shadows and spacing, normalised key card surfaces, and tightened mobile vertical rhythm and footer safe-area spacing.
- Added an AI `get_commerce_catalogue` tool backed by the same server-side `PRODUCT_CATALOG` and `AIRSIDE_MENU` used by checkout. The assistant can recommend a matching Songa product and quote exact catalogue prices; it must direct the traveller to Travel Services for review and explicit PayPal approval. It cannot create or capture payment in chat.
- Added separate Vercel build modes and PowerShell release automation for Sandbox and Live browser bundles, plus separate Supabase Edge Function secret templates.
- Updated static verification from 53 to 57 source assertions; all 57 pass.
- A fresh dependency install timed out in this packaging environment and left an incomplete `node_modules`; therefore TypeScript, ESLint, Vite builds, browser/device visual QA, live Supabase operations and PayPal Sandbox payment tests are not claimed as passed. Run the supplied one-command release script on the stable laptop before deploying.
