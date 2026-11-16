# Songa 2.0 — UK-first, global-ready release

## Release intent
Songa launches its next experience with the United Kingdom as the first acquisition and passenger-rights market, while keeping location, airports, weather, currency, date/time, and rights evaluation country-aware for travellers worldwide. The production `main` branch is not changed by this release candidate.

## Traveller context
- Ask for location with a clear consent prompt; never trigger geolocation without a user action.
- If permission is granted, resolve coordinates to a country, region, city and timezone using the server-side WeatherAPI integration.
- If permission is denied or unavailable, allow manual country/city/airport selection.
- Prefer the active journey's origin, destination and current aircraft position over device location when presenting journey weather.
- Nearest-airport selection must use a maintained airport dataset/provider and distance calculation. Do not infer an airport from a city name or show an unverified result.
- Persist user-approved home airport and preferences to their authenticated profile; do not silently persist precise device coordinates.

## Weather
Set `WEATHERAPI_KEY` as a Supabase Edge Function secret. Deploy `songa-weather`. The browser calls this function; the key never appears in Vite variables or client code. The function validates coordinates/query, requests current and forecast data, and applies a short isolate cache. Production-grade shared caching/rate limiting should use a Supabase table or external cache before high traffic. Free WeatherAPI usage requires attribution; show a WeatherAPI credit where its data is rendered.

Weather at a location is not cabin temperature or cruise-altitude weather. When using aircraft coordinates, label it as approximate ground-level weather near the aircraft position.

## Compensation and AirHelp
- Rights are evaluated from the journey, not simply the user's GPS country: departure/arrival countries, operating carrier, itinerary, disruption type, timing and cause matter.
- UK-first content should explain UK261 and relevant UK passenger rights without promising compensation.
- EU261 may apply to flights departing the EU and certain arrivals to the EU on qualifying carriers. Evaluate the actual itinerary and operating carrier.
- AirHelp availability is a separate partner-coverage decision. Set `AIRHELP_SUPPORTED_COUNTRIES` as a comma-separated ISO-3166-1 alpha-2 list only after checking the live TradeTracker campaign terms / AirHelp partner account. UI should show a subtle supported/not-supported note based on this configured list. A country match is not a guarantee that a specific claim is accepted.
- Do not show an AirHelp referral CTA where partner coverage is not confirmed. Offer neutral rights information instead.
- Track affiliate impressions and clicks separately, using the exact campaign creative URLs/pixels supplied by TradeTracker. Never invent tracking IDs.

## PayPal Live
The source supports PayPal Orders v2, but a working live integration requires:
1. A PayPal Live REST app created under the intended merchant account.
2. Supabase Edge Function secrets: `PAYPAL_ENVIRONMENT=live`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and the live `PAYPAL_COMMERCE_WEBHOOK_ID`.
3. A live webhook configured for the deployed commerce webhook endpoint and subscribed to the events documented in the deployment guide.
4. A low-value live purchase and refund test, verifying merchant receipt, capture, webhook signature, idempotent fulfilment and customer entitlement.
5. Confirm the live REST app belongs to the intended PayPal account (currently requested: owenroki73@gmail.com). Never commit credentials or claim payment routing is verified from source code alone.
6. Confirm purchase unit payee/merchant details if the business account requires explicit payee routing; do not accept arbitrary client-supplied payee addresses.

## UK-first acquisition / global readiness
- UK landing pages and passenger-rights education are the initial SEO and paid-search focus.
- Country/region selection and rights evaluation remain data-driven, not hardcoded to UK.
- Localise currency, dates, time zones, airport suggestions and weather labels.
- Preserve public SEO pages while requiring authentication for saved journeys, watchlists and personalisation.
- Search quota counts user-initiated searches. Scheduled monitoring of a saved flight must not consume search quota.

## Release blockers before production
- Add WeatherAPI key as Supabase secret and deploy the Edge Function.
- Wire consent UI, location state, weather cards and manual location fallback into the active screens.
- Verify airport lookup against a maintained global airport dataset.
- Reconcile current frontend watchlist tables with the target Supabase schema before enabling scheduled alerts.
- Verify AeroAPI plan/quota and server-side watch cadence.
- Configure actual AirHelp supported-country list from partner terms and test impression/click tracking.
- Configure PayPal Live credentials/webhook and complete merchant-account test.
- Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, and end-to-end tests on the release branch.
- Deploy preview first; do not promote to production until acceptance tests pass.
