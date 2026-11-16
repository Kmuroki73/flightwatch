# Songa 3.0 — clean rebuild with infrastructure preservation

## Non-negotiable rule

Rebuild the traveller-facing application from a clean product architecture, but do not replace, reset, rotate, migrate, or redeploy existing infrastructure until it has been inventoried and verified. No secrets belong in this repository.

This branch starts from `main`. The earlier Songa 2.1 experiment remains isolated and is not the production branch.

## Existing infrastructure recorded in the repository

### Supabase
- Existing project reference in the handoff: `qrvzpfdlyzmnzblaildz`.
- Browser configuration: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Existing auth: Supabase email/password and Google OAuth.
- Existing account data and services: `flight_watches` joined to `flights`; `songa_traveller_profiles`; commerce orders and entitlements; WhatsApp connection/message records; AI usage records.
- Existing Edge Functions include:
  - `flight-search`
  - `flight-positions`
  - `songa-ai-assistant`
  - `songa-weather`
  - `whatsapp-link`, `whatsapp-webhook`, `whatsapp-alerts`
  - PayPal order/capture/webhook functions
  - Songa commerce, group-watch, gift-redemption and accommodation-search functions.
- Do not reset the project or run migrations blindly. Confirm the actual deployed project and remote schema first.

### Server-side provider secrets (Supabase Edge Function Secrets)
- FlightAware AeroAPI: `AEROAPI_API_KEY` (legacy alias `AEROAPI_KEY`).
- Songa AI: `GROQ_API_KEY`, optional `GROQ_MODEL`; fallback `GEMINI_API_KEY`, optional `GEMINI_MODEL`.
- Weather: `WEATHERAPI_KEY`.
- WhatsApp/Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, optional `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_WHATSAPP_FROM`.
- PayPal: `PAYPAL_ENVIRONMENT`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_COMMERCE_WEBHOOK_ID`.
- Other server settings: `SONGA_APP_URL`, `SONGA_RATE_LIMIT_SALT`, `SONGA_PREMIUM_PRICE_USD`, `SONGA_ENABLE_GLOBAL_MAP`, optional accommodation adapter URL/token.
- Supabase injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into Edge Functions. Never expose the service-role key in browser configuration.

### Vercel
- Existing app is a Vite project; expected build command `npm run build`, output `dist`.
- Browser-safe environment variables are the Supabase URL and anon/publishable key, plus optional function URL overrides.
- The actual Vercel project/domain mapping and production/preview environment values must be checked in Vercel before release. GitHub source does not expose these values.

### Other integrations
- AirHelp: source documents an existing TradeTracker affiliate destination in the UI; no AirHelp API key is expected. Validate current affiliate URL and attribution before release.
- Accommodation: adapter contract exists, but no live inventory/booking supplier is confirmed in source.
- WhatsApp alert worker: Twilio integration exists in source, but worker schema must be reconciled with the current `flight_watches` schema before enabling scheduled alerts.
- Email: no confirmed email sender integration or environment variables are documented in this repository inventory. Verify separately before promising email notifications.

## Known risks that must be resolved before claiming production-ready

1. The screenshot's AI unavailable state is consistent with the frontend not receiving valid Supabase browser configuration, or the AI Edge Function/secrets not being deployed/configured in the Supabase project actually used by that deployment. The source does contain a real `songa-ai-assistant` function using Groq and Gemini; the UI is not the only missing piece.
2. Flight search uses Supabase Edge Function `flight-search`, which reads AeroAPI secrets server-side. Do not put AeroAPI keys into Vercel `VITE_*` variables.
3. The source watchlist uses `flight_watches` joined to `flights`. The WhatsApp alert worker still references legacy `watched_flights` and related legacy event tables. Reconcile against the live schema before enabling alerts.
4. Global aircraft positions are intentionally disabled by default unless `SONGA_ENABLE_GLOBAL_MAP=true`; verify provider plan permissions and request costs before enabling.
5. PayPal Sandbox and Live credentials must not share one Supabase project if both environments run concurrently. Preserve current payment mode and webhook configuration until explicitly verified.
6. A successful GitHub build is not proof that production Vercel is serving the intended branch or that Supabase functions/secrets are connected.

## Songa 3.0 product architecture

Rebuild the customer experience around clear tasks, not a collection of disconnected demo panels:
1. **Flights** — flight-number/date search, provider-labelled results and clear next actions.
2. **My journeys** — saved journeys, current status, update history and alert preferences.
3. **Songa AI** — real assistant connected to `songa-ai-assistant`, grounded in the selected flight and honest about missing data.
4. **Travel services** — existing commerce catalogue, AirHelp referral and only verified supplier services.
5. **Profile** — Supabase account, Google/email sign-in, traveller preferences, WhatsApp connection and payment history.

Keep responsive mobile and desktop navigation consistent. Remove fake aircraft, invented gates, demo-only claims presented as live, technical configuration errors and inactive controls. Do not remove a working capability merely because its current screen is poorly designed.

## Safe rebuild sequence

1. Audit actual Vercel project/domain and environment-variable names without displaying or copying secret values.
2. Verify Supabase project reference, deployed Edge Functions, secrets presence (presence only, never print values), auth providers, database tables, RLS policies and webhook endpoints.
3. Write a compatibility map from existing UI actions to existing Edge Functions/tables.
4. Build Songa 3.0 UI on this branch while preserving the current data contracts.
5. Run typecheck, lint, production build and mobile/desktop QA.
6. Test flight search, auth, save/reload/remove watch, AI response, WhatsApp verification, and Sandbox checkout against the existing services.
7. Deploy to a Vercel preview first. Promote to production only after the preview is verified on the real domain configuration.

## Explicitly out of scope until verified

- No Supabase project reset or replacement.
- No unreviewed database migration or schema rename.
- No secret rotation or key regeneration.
- No PayPal live-mode switch.
- No production domain or DNS changes.
- No removal of existing provider functions.
- No claim that AI, live map, WhatsApp alerts, email or payments are operational until tested end-to-end.
