# Songa Flight Watch — November 11 release preparation handoff

## What changed in this source candidate

1. Normalized the uploaded ZIP's Windows-style path separators into a standard source tree. Root-level duplicate copies from the original archive were not carried into this release package; canonical files are under `src/`, `supabase/`, `public/` and `scripts/`.
2. Hardened `songa-commerce-webhook`:
   - verifies PayPal signatures before touching event state;
   - claims events through a database RPC with a five-minute processing lease;
   - prevents concurrent deliveries from simultaneously processing one event;
   - validates capture ID, amount and currency before fulfilment;
   - checks order, entitlement, Airside and event-update errors;
   - releases failed events for PayPal retry.
3. Added `20261111000100_songa_webhook_reliability.sql` for processing leases, attempts and error details. The commerce webhook now requires the dedicated `PAYPAL_COMMERCE_WEBHOOK_ID`; it no longer silently falls back to the legacy webhook ID.
4. Added accommodation search UI and `songa-accommodation-search`, an authenticated server-side HTTPS provider adapter. It returns only provider-backed normalized offers and never invents hotel listings.
5. Added `ACCOMMODATION_PROVIDER_CONTRACT.md` describing the required search, hold, confirm, retrieve, cancellation and refund capabilities before live hotel checkout can be enabled.
6. Added a signed-in traveller profile editor for display name, home airport, preferred currency and travel-interest tags; added the RLS-protected `songa_traveller_profiles` migration.
7. Songa AI now uses saved traveller preferences as optional context for signed-in users. It does not infer preferences when none are saved.
8. Updated Supabase deployment instructions, release notes, `.env.example` and the dependency-free source smoke test.

## What is present for Airside

The JKIA Airside section already provides a menu, cart quantities, server-calculated total, PayPal Sandbox order creation, database order and pickup reference. It is explicitly a Sandbox merchant experience. There is no real airport restaurant, inventory, kitchen, merchant settlement or physical pickup operation connected.

## What is not yet a live integration

- Accommodation search requires a contracted supplier adapter and secrets. Booking/hold/confirm/cancellation and hotel PayPal checkout are not enabled until that supplier contract/API exists.
- Airside requires a real airport merchant partner for physical order fulfilment.
- WhatsApp alert worker still uses the legacy `watched_flights` table while the current frontend watchlist uses `flight_watches` joined to `flights`. Do not enable scheduled alert sending until the live schema is inspected and the worker is reconciled.
- Live provider calls, PayPal Sandbox transactions, Supabase migrations/deployments and Vercel Production deployment require the owner's credentials and environment.

## Checks completed in this packaging environment

- `node scripts/verify-milestone2.mjs`: passed 53 static source assertions.
- TypeScript transpilation/syntax check: 38/38 `.ts` and `.tsx` files passed.
- A fresh `npm ci --no-audit --no-fund` attempt timed out in this environment.
- Dependency-aware typecheck, ESLint and Vite production build therefore remain unverified.
- No remote Supabase migration, Edge Function deployment, PayPal transaction, GitHub commit/push or Vercel deployment was performed.

## Next shared test sequence

1. On the user's Windows machine, run `npm.cmd ci --no-audit --no-fund`, then `npm.cmd run verify:milestone2`, `npm.cmd run typecheck`, `npm.cmd run lint` and `npm.cmd run build`.
2. Review the existing live Supabase schema and back it up. Apply only the reviewed new migrations in order.
3. Deploy Edge Functions and configure Sandbox-only secrets, including separate legacy and commerce PayPal webhook IDs.
4. Run all PayPal Sandbox product tests and negative cases. Check persisted order, capture, fulfilment and entitlement records after each test.
5. Verify live flight search, Flight Watch persistence, AI personalization, group/gift flows, WhatsApp and Airside Sandbox ordering.
6. Select and configure the accommodation supplier before enabling actual room reservations or charging for stays.
7. Only after all gates pass, consolidate and push the release commit, deploy Vercel Production, and switch PayPal to live credentials.


## Product naming and responsive experience clarification

- The customer-facing airport commerce area is named **Songa Airport Marketplace**, not JKIA Airside. Nairobi (NBO) is the first configured sandbox merchant location only; additional airport locations require merchant onboarding and configuration.
- The signed-in Account screen contains the traveller profile editor for display name, home airport, preferred currency and travel interests. The AI Edge Function loads these saved preferences for signed-in users and includes them as optional personalisation context.
- Responsive breakpoints and mobile layouts are present for the main app, commerce, traveller profile and accommodation search. Responsive appearance still requires browser/device testing after dependencies are installed.
- Personalisation requires applying `20261111000200_songa_traveller_personalisation.sql` to the target Supabase project and signing in before profile preferences can be saved.
