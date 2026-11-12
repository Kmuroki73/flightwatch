# Songa Flight Watch — corrected source handoff

## Changes in this handoff

- Uses the production schema supplied on 27 October 2026: `flight_watches` joined to `flights`.
- Stops querying the legacy `watched_flights` table in the frontend watchlist integration.
- Creates or finds a normalized `flights` row, then creates a user-scoped `flight_watches` row.
- Loads active watches with linked flight details.
- Stops a watch by setting `active = false` and `stopped_at`, preserving history.
- Does not include a local `.env`, `node_modules`, `.git`, or stale `dist` output.

## Important verification status

This is a source correction, **not a verified production build**. Installing dependencies failed because the npm package tarball `yocto-queue-0.1.0.tgz` is not available in the local cache and this environment could not fetch it from the npm registry. Therefore a fresh `dist` has not been generated and no end-to-end Supabase test has been run here.

## Before production deployment

1. Install dependencies in a network-enabled local environment or Vercel.
2. Run `npm ci`, `npm run typecheck`, `npm run lint`, and `npm run build`.
3. Confirm the `flight_watches.flight_id` foreign key points to `flights.id` and the Supabase relationship is exposed to PostgREST.
4. Confirm authenticated users have RLS policies permitting SELECT/INSERT/UPDATE only for their own `flight_watches` rows, and that the `flights` table policies permit the intended flight lookup/insert pattern.
5. Test with a real signed-in account: search a live flight, add it to Flight Watch, reload the page, confirm it remains saved, stop watching it, and confirm it disappears from active watches.
6. Verify that `flights.provider` and `flights.ident` values comply with your live database constraints and that the provider ID lookup does not reuse a flight record for a different journey.

## Environment safety

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project environment settings. Do not commit `.env` or expose service-role keys, AeroAPI credentials, or messaging-provider secrets through `VITE_*` variables.
