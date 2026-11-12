# Songa AI 2.0 — Hackathon readiness map

The PayPal AI Hackathon uses five weighted judging areas: Technological Implementation, Design, Potential Impact, Innovation/Idea, and Presentation. Eligibility and required submission elements are separate pass/fail checks.

## Five judging areas

1. **Technological Implementation** — source includes the existing flight-search integration, a server-side OpenAI Responses API assistant with a flight-search function tool, and PayPal Orders v2 create/capture/webhook functions. These functions still require deployment, secrets, migrations, and live Sandbox verification.
2. **Design** — mobile-first, orange-led, guest-first flight search; clear provider/freshness labels; responsive navigation; accessible form controls and honest unavailable states.
3. **Potential Impact** — focused on missed flights and uncertainty caused by changing schedules, delays, cancellations, gates, terminals and other operational updates when providers supply them.
4. **Innovation/Idea** — connects persistent flight-watch workflows, provider-backed flight intelligence, AI explanation, assistance referrals and payment for a defined travel-assistance offering.
5. **Presentation** — the project story and release notes support a concise demo narrative. The final YouTube demo, polished screenshots and judge walkthrough still need to be recorded after deployment and end-to-end testing.

## Required pass/fail submission checks still outstanding

- Deploy and test PayPal Sandbox create/approve/capture flow and verified webhook.
- Deploy and test the OpenAI Edge Function with actual API credentials and the existing flight-search function.
- Verify the live `flight_watches` to `flights` schema and RLS policies against the linked Supabase project.
- Reconcile the existing WhatsApp alert worker, which currently reads the older `watched_flights` schema. Do not enable scheduled alerts until reconciled.
- Confirm FlightAware's contract permits commercial B2C use before enabling the global aircraft-position map; it is disabled by default.
- Run clean `npm ci`, typecheck, lint and standard Vite production build in a network-enabled environment.
- Verify the actual public Vercel Production deployment and perform the controlled cutover only after staging tests.
- Ensure the GitHub repository has the MIT licence and complete README/setup/integration explanations. The source package includes these; they must still be committed to the public repository.
- Record and publish an under-three-minute YouTube video, public or unlisted, with no password.
- Keep judge testing free and unrestricted through the judging period; use Sandbox credentials only.

## Release safety

This package does not apply migrations to Supabase, deploy Edge Functions, set secrets, push commits, or modify Vercel Production. The global flight map is disabled until its provider contract and costs are confirmed. Existing Flight Watch tables and records are not modified by the new migration.
