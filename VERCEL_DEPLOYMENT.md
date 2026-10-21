# Songa Flight Watch — Vercel deployment notes

This package merges the uploaded Live Desk patch into the full project and retains the
`.bolt/` project metadata. It excludes `node_modules`, `dist`, `.git`, local environment
files, and local Supabase CLI state.

## Vercel
- Framework preset: Vite
- Root directory: repository/project root (the folder containing `package.json`)
- Build command: `npm run build`
- Output directory: `dist`
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Environment Variables.
- Never add Supabase service-role, FlightAware/AeroAPI, or Twilio secrets as `VITE_*` values.

## Supabase authentication
The frontend retains the existing Supabase email/password and Google OAuth flows.
For production sign-in, confirm in Supabase Authentication settings:
- Google is enabled and its OAuth client configuration is valid.
- Site URL points to the production Vercel domain.
- Redirect URL allowlist includes the production domain (and preview domains if needed).
- Email/password authentication is enabled.

## Live flight data
The frontend calls the existing Supabase Edge Function `flight-search`.
Deploy that function to the existing Supabase project and configure the provider key as a
Supabase Function secret (AEROAPI_API_KEY, or the existing supported AEROAPI_KEY name).
Do not expose that key in Vercel frontend variables.

## Watchlist / Live Desk database prerequisite
The app's current watchlist code uses `watched_flights`, and its migrations create
`watched_flights`, `flight_snapshots`, and `disruption_events`. The previously inspected
remote Supabase schema did not show those tables. Therefore persistent watchlist saving
will not work in production until the required migrations are reviewed and applied to the
existing Supabase project. This ZIP does not apply migrations or alter your database.
Review the migration files in `supabase/migrations/` before applying anything.

## Verification status
This is a Vercel-ready source package, but a clean production build could not be verified
in this environment because dependency installation did not complete successfully here.
Run `npm install`, `npm run typecheck`, and `npm run build` in the project environment
before treating the deployment as verified.
