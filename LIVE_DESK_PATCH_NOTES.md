# Songa Flight Watch — Live Desk patch

## What changed
- Reworked the Live Desk into a high-contrast airport operations terminal (dark green, white, orange, monospaced data).
- Added a flight table, data-link status, last-poll indicators, manual provider polling, and a session event stream.
- The desk now polls saved flights immediately when opened and every 2 minutes while the tab is visible.
- Flight changes are detected in the browser session when a previous live provider response differs from the next live response.
- The Live Desk no longer writes to `flight_snapshots` or `disruption_events`; this avoids silently depending on those tables while the remote schema is being reconciled. The session event stream is temporary and resets when the page/session is reloaded.
- Demo responses are explicitly labelled as demonstration data, not live flight data.

## Checks
- TypeScript typecheck passed.
- ESLint on `src/screens/LiveDeskScreen.tsx` passed; whole-project lint has only the two existing warnings in `AirportBoard.tsx` and `WorkspaceScreens.tsx`.
- A production build could not be run in this environment because the uploaded `node_modules` package lacks Rollup's Linux optional binary. Run `npm install` and `npm run build` on your Windows machine before deployment.

## Important deployment notes
1. Do not upload `.env.local`, `node_modules`, or `dist` to the repository.
2. In Vercel Project Settings → Environment Variables, configure the frontend variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Optional: `VITE_FLIGHT_SEARCH_FUNCTION_URL` only if you need to override the default Supabase Edge Function URL.
3. The frontend calls the Supabase Edge Function `flight-search` by default. For live data, that function must be deployed and its server-side AeroAPI secret must be configured in Supabase Edge Function secrets. Never put the AeroAPI key in a `VITE_` variable.
4. **The database/watchlist mismatch is not resolved by this visual/polling patch.** The app's watchlist code currently expects `watched_flights`, `flight_snapshots`, and `disruption_events`, while the remote database inspected previously uses `flights`, `flight_watches`, and `flightaware_webhook_events`. The Live Desk can poll only after a signed-in user has a working saved-flight watchlist. Do not run `supabase db push`, reset, or migrations until the schema reconciliation plan is reviewed.
5. WhatsApp integration is deliberately left for the next phase, after live flight data is verified.

## Suggested Vercel test
After the schema/watchlist issue is resolved and the frontend has been deployed:
- Sign in.
- Add one flight to My Flight Watch.
- Open Live Desk and click **Poll provider**.
- Confirm the status strip says **LIVE DATA LINK ESTABLISHED**. If it says **DEMONSTRATION DATA — NOT LIVE**, the Edge Function returned demo fallback data rather than live AeroAPI data.
- Check Vercel and Supabase Edge Function logs for deployment/configuration errors.
