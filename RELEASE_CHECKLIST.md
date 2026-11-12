# Songa AI 2.0 release checklist

## Confirm before production

- [ ] Confirm that this source snapshot matches the intended Vercel Production source. The screenshot supplied for audit showed an October 21 Preview deployment on `fix-watchlist`, not a verified Production deployment.
- [ ] Run `npm ci`, `npm run typecheck`, `npm run lint`, and `npm run build` in a network-enabled environment.
- [ ] Configure public Supabase URL and anon/publishable key in Vercel.
- [ ] Confirm remote `flight_watches` → `flights` foreign key and PostgREST relation, RLS policies, unique constraints and authenticated read/write permissions.
- [ ] Confirm `addWatchedFlight`, `loadWatchedFlights`, and `removeWatchedFlight` end-to-end with a real test account. Do not run legacy migrations or reset the database.
- [ ] Reconcile `whatsapp-alerts`: the existing worker still reads legacy `watched_flights`, while the newer frontend adapter reads `flight_watches` joined to `flights`. Do not enable scheduled alert delivery until its query, snapshot/change detection and RLS/service-role behaviour match the confirmed remote schema.
- [ ] Confirm WhatsApp sender ownership, template/consent requirements, webhook URL and delivery status with the configured provider. The existing code is Twilio-based; this package does not silently replace it with Meta Cloud API.
- [ ] Add `GROQ_API_KEY` and `GEMINI_API_KEY` to Supabase Edge Function secrets. Deploy `songa-ai-assistant`; test Groq tool calling, Gemini fallback, no-data/unavailable cases and provider rate limits.
- [ ] Apply the new PayPal migration after schema review. Configure PayPal Sandbox credentials and webhook ID; rotate any Sandbox secret previously shared in chat.
- [ ] Test PayPal success, cancellation, duplicate capture, pending/denied capture, mismatched amount, duplicate webhook and invalid webhook signature.
- [ ] Confirm the actual premium deliverable and service fulfilment process before charging real customers. The current $3.99 is a Sandbox placeholder.
- [ ] Keep `SONGA_ENABLE_GLOBAL_MAP=false` until FlightAware confirms a commercial B2C plan/permission and expected usage cost. Then test the positions endpoint and provider coverage.
- [ ] Test mobile widths (320, 360, 390, 430 px), tablet and desktop; check accessibility, keyboard and reduced motion.
- [ ] Verify AirHelp deep link and TradeTracker attribution using the actual affiliate account; do not rely on an affiliate dashboard URL as a referral URL.
- [ ] Verify Google Analytics and UTM attribution for TikTok/WhatsApp campaigns.
- [ ] Upload final screenshots and record the public/unlisted YouTube demo under 3 minutes for Devpost.
- [ ] Confirm repo licence, README, build instructions and judge credentials (Sandbox only) before submission.

## Important current limitations

- A production Vite build and typecheck were not run in this environment because dependencies could not be installed from the npm registry. The static ESM fallback is generated separately and uses CDN imports.
- No Supabase migration has been applied to the live project.
- No PayPal Sandbox credentials or OpenAI API key were provided in this session; the Edge Functions are source-ready but cannot be verified against live credentials here.
- Global aircraft positions are gated off by default to avoid an unintended provider bill or unsupported commercial use.
- Background Flight Watch monitoring is not the same as a browser-tab polling experience. Confirm a scheduled server-side monitor/webhook before promising 24/7 monitoring.
