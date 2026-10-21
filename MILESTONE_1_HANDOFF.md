# Songa Flight Watch — Milestone 1 handoff

## Changes in this copy
- Added `src/screens/LiveDeskScreen.tsx` and the Live Desk navigation route.
- Added provider-backed manual refresh for the signed-in user's saved watches.
- Added snapshot comparison and event insertion using the existing `flight_snapshots` and `disruption_events` tables.
- Added `supabase/migrations/20261019160000_add_delay_minutes_to_flight_snapshots.sql` for normalized delay-minute fields.

## Important deployment notes
- This is a local working copy; the live Bolt deployment has not been changed.
- Apply the new migration to the existing Supabase project before using the updated screen. The screen selects and inserts the two new delay columns.
- No scheduled background monitor was added. Refresh is initiated by the user; the page refreshes the activity list periodically while visible, but does not poll AeroAPI continuously.
- Real provider checks require the existing Vite/Supabase environment variables and deployed `flight-search` Edge Function. The `.env` file was intentionally excluded from this handoff archive for secret safety.

## Verification status
- Source-level integration and route wiring were inspected.
- `npm run typecheck` could not run because the dependency installation was incomplete; npm installation stalled in this environment and `vite` was unavailable.
- Production build and lint therefore remain unverified. Do not deploy until dependencies are installed and these checks pass.
- No live AeroAPI, database, or Twilio requests were made from this environment.
