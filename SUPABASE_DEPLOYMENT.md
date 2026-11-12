# Supabase deployment — Songa AI 2.0

**Do not apply anything to production until the current schema has been inspected and backed up.** This package deliberately does not reset or migrate the existing Flight Watch tables.

## Project

Existing project reference in the working handoff: `qrvzpfdlyzmnzblaildz`.

Link from the project root:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref qrvzpfdlyzmnzblaildz
```

## Migration review

Inspect the remote schema and review these migrations in order:

1. `supabase/migrations/20261108000100_songa_payments_and_ai.sql`
2. `supabase/migrations/20261109000100_songa_shared_commerce.sql`
3. `supabase/migrations/20261111000100_songa_webhook_reliability.sql`
4. `supabase/migrations/20261111000200_songa_traveller_personalisation.sql`

The second migration adds `songa_commerce_orders`, `songa_commerce_entitlements`, group journey/member/flight tables, `songa_airside_orders` and webhook-event storage. It is designed to be isolated from Flight Watch tables, but it must still be reviewed against the actual remote project before execution.

**Do not** run `supabase db reset`, all old migrations or an unreviewed `supabase db push` against the production project.

## Edge Functions to deploy after migration review

Existing provider and messaging functions:

```powershell
npx.cmd supabase functions deploy flight-search
npx.cmd supabase functions deploy whatsapp-link
npx.cmd supabase functions deploy whatsapp-webhook
npx.cmd supabase functions deploy whatsapp-alerts
```

AI, map and legacy per-flight PayPal functions:

```powershell
npx.cmd supabase functions deploy songa-ai-assistant
npx.cmd supabase functions deploy flight-positions
npx.cmd supabase functions deploy paypal-create-order
npx.cmd supabase functions deploy paypal-capture-order
npx.cmd supabase functions deploy paypal-webhook
```

Shared Songa Commerce functions:

```powershell
npx.cmd supabase functions deploy songa-commerce-create-order
npx.cmd supabase functions deploy songa-commerce-capture-order
npx.cmd supabase functions deploy songa-commerce-webhook
npx.cmd supabase functions deploy songa-group-add-flight
npx.cmd supabase functions deploy songa-join-group
npx.cmd supabase functions deploy songa-redeem-gift
npx.cmd supabase functions deploy songa-accommodation-search
```

Deploy only after reviewing the source and confirming the target environment. Preserve the current working functions until replacements are tested.

## Edge Function secrets

Set secrets in Supabase Dashboard → Edge Functions → Secrets. Never paste values into frontend code or commit them.

- `AEROAPI_API_KEY` (or the existing supported `AEROAPI_KEY`)
- `GROQ_API_KEY` (primary LLM provider)
- `GEMINI_API_KEY` (fallback LLM provider)
- Optional `GROQ_MODEL=openai/gpt-oss-20b` and `GEMINI_MODEL=gemini-2.5-flash`
- `PAYPAL_ENVIRONMENT=sandbox`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET` (rotate the previously shared Sandbox secret)
- `PAYPAL_WEBHOOK_ID` for `paypal-webhook`
- `PAYPAL_COMMERCE_WEBHOOK_ID` for `songa-commerce-webhook`
- `SONGA_APP_URL=https://songa.co.ke`
- `ACCOMMODATION_ADAPTER_URL` (HTTPS endpoint implementing Songa's normalized accommodation search contract)
- `ACCOMMODATION_ADAPTER_TOKEN` (server-side bearer token for that adapter)
- `SONGA_RATE_LIMIT_SALT` (long random value)
- `SONGA_ENABLE_GLOBAL_MAP=false` until provider permissions and cost are confirmed
- Existing Twilio credentials if the current WhatsApp flow uses them: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_WHATSAPP_FROM`

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Do not expose the service-role key.

## PayPal webhooks

Register separate PayPal Sandbox webhook endpoints:

- `https://qrvzpfdlyzmnzblaildz.supabase.co/functions/v1/paypal-webhook`
- `https://qrvzpfdlyzmnzblaildz.supabase.co/functions/v1/songa-commerce-webhook`

Use the webhook IDs for the matching endpoints. Subscribe to the payment capture events handled in the respective function. Verify signature validation, duplicate-event behaviour and payment state transitions before using any live credentials.

## Flight Watch / WhatsApp schema warning

The newer frontend adapter in `src/lib/watchlist.ts` reads `flight_watches` joined to `flights`. The existing WhatsApp alert worker in `supabase/functions/whatsapp-alerts/index.ts` still references the older `watched_flights` schema. Inspect the actual live schema and reconcile the alert worker before enabling scheduled WhatsApp disruption alerts. Do not guess a replacement query or alter the watchlist tables blindly.

## Accommodation provider adapter

The source includes `songa-accommodation-search`, which authenticates the signed-in user and proxies a normalized search request to a provider adapter. Configure `ACCOMMODATION_ADAPTER_URL` and `ACCOMMODATION_ADAPTER_TOKEN` only after selecting and contracting an accommodation supplier. The adapter accepts `{ action: "search", city, checkIn, checkOut, guests, currency }` and returns `{ providerName, offers: [{ id, name, location, description?, imageUrl?, price, currency, priceUnit? }] }`. Results are validated server-side; no demo hotel inventory is fabricated.

The current source does not create a hotel reservation or charge for accommodation. A supplier must first provide a book/hold/confirm API and commercial payment terms. Only then should a hold-and-PayPal-capture flow be enabled; do not charge a traveller for an unconfirmed room.

## Traveller personalisation

Apply `20261111000200_songa_traveller_personalisation.sql` to add the RLS-protected `songa_traveller_profiles` table. Each signed-in user can read and update only their own display name, home airport, preferred currency and travel-interest tags. The account screen will display the preference editor after this migration is applied. The UI does not write preferences to public metadata or expose another user's profile.
