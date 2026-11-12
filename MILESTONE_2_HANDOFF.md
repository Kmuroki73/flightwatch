# Songa AI 2.0 — Milestone 2 implementation handoff

## Implemented in this source update

- Shared server-controlled PayPal Commerce catalogue for Premium 30-day and 365-day passes, Trip Rescue, Family & Group Watch, Gift Journey Watch and the NBO Airside Sandbox order.
- Checkout creates orders server-side; product amounts and Airside line totals are calculated from the server catalogue.
- Capture verifies the signed-in owner, PayPal completion state, capture state, currency and exact amount before issuing fulfilment.
- PayPal webhook signature verification and event persistence. Failed webhook events remain retryable; already-processed duplicate events are acknowledged without repeating work.
- Idempotent fulfilment recovery for partially created Family Watch purchases.
- Gift redemption uses a conditional update and verifies that the claim actually won, preventing two accounts from receiving the same gift in a concurrent claim.
- RLS-backed Commerce data access and service-role-only writes, as defined in the shared Commerce migration.
- Personal dashboard with saved flights, active entitlements, paid orders and recent searches. Recent search history is stored locally per signed-in user/device; orders and entitlements are loaded from Supabase.
- WhatsApp `SERVICES`/`BUY`/`PRICES` commands route to the same web Commerce catalogue and secure checkout; `MYSONGA` returns recent orders and entitlements only for a verified linked WhatsApp number. The web app remains the checkout surface.
- Persisted dark/light theme preference (existing theme control retained), with dark-theme styling for the Commerce Desk and a dimensional premium travel hero.
- Responsive dashboard layouts and a static Milestone 2 source smoke-check script.

## Important boundaries

- PayPal amounts are still Sandbox catalogue values: Premium USD 25/30 days and USD 250/365 days; Trip Rescue USD 4.99; Family Watch USD 9.99; Gift Watch USD 4.99; Airside is server-calculated. Review and approve commercial prices separately before live payments.
- Airside remains a JKIA/NBO Sandbox merchant demo. It does not connect to a real airport merchant, stock system, pickup counter or fulfilment partner.
- Premium passes are prepaid, not recurring subscriptions.
- A source ZIP cannot deploy Supabase migrations/functions, configure secrets, register PayPal webhooks, or prove a live Sandbox transaction. Those steps require the project owner's credentials and linked services.
- The current package still requires a real PayPal Sandbox end-to-end test for each product family and remote Supabase schema/RLS verification.

## Verification performed for this handoff

- All 36 `.ts`/`.tsx` files were parsed/transpiled with TypeScript 5.8.3: zero syntax/transpilation diagnostics.
- `npm run verify:milestone2` is included as a dependency-free source smoke check.
- A fresh dependency install did not complete in this environment; the partially installed `node_modules` was excluded from the release archive. Consequently a clean dependency-aware typecheck, ESLint run and Vite production build are still required on the user's Windows machine.
- No remote database migration, Edge Function deployment, PayPal call, commit, push or Vercel deployment was performed.

## Next gate

Complete the PowerShell validation commands in `MILESTONE_2_POWERSHELL.md`. Do not apply migrations or deploy until those checks pass and the current Supabase schema has been reviewed/backed up.
