# Songa 2.5.0 — UK-first release handoff

**Branch:** \`songa-2.5.0-uk-first\`  
**Base:** \`songa-2.1-product-overhaul\`  
**Product version:** \`2.5.0\`  
**Release status:** engineering candidate; not production-certified  
**Design source:** the supplied Stitch export, retained in \`public/stitch/\` (100 tracked design/reference files)

## What this branch changes

### UK-first traveller experience
- Updates the main flight landing experience to lead with UK-first flight intelligence and passenger-rights guidance while retaining global flight lookup where provider data is available.
- Uses UK flight-number examples rather than Kenyan/African-first examples.
- Adjusts provider-status copy so that a configured Edge Function endpoint is not presented as proof that an upstream flight provider is currently responding.
- Corrects the flight-provider fallback: when FlightAware does not provide an IATA operator code, derive the airline designator from the flight identifier before using a carrier-name fallback.

### Route-aware passenger-rights screening
- Replaces the previous jurisdiction logic that treated London airports as EU airports and treated British Airways as an EU carrier.
- Adds a conservative airport reference set for common UK, European and major international gateways.
- Evaluates UK261 first for flights departing the UK, and qualifying flights arriving in the UK on a UK/EU operating carrier.
- Evaluates EU261 for mapped EU/EEA/Swiss departures and qualifying arrivals.
- Calculates great-circle distance only where both airports exist in the reference set.
- Applies UK care thresholds by route distance (2/3/4 hours of expected departure delay) and uses verified arrival delay for the general 3-hour compensation screen.
- Shows indicative UK compensation amounts only for mapped routes with a reported arrival delay meeting the screen. It deliberately does not estimate a cash amount for cancellations because notification and rerouting facts are needed.
- Adds qualification notes, a copyable request to the airline and a link to the UK Civil Aviation Authority.

This is an informational screen, not a legal opinion or a guaranteed eligibility decision. The airport list and carrier-code mapping are deliberately incomplete; unknown routes are shown as requiring further review rather than guessed.

### Real Trip Workspace document upload
- Removes the previous simulated boarding-pass and receipt uploads, which inserted sample seat, merchant and amount data without uploading a file.
- Adds actual private file upload to the Supabase Storage bucket \`songa-trip-documents\`.
- Restricts uploads to PDF, JPEG, PNG and WebP, with a 15 MB limit.
- Stores each file under the authenticated user's UUID and creates a corresponding \`trip_documents\` metadata row.
- Opens files through a short-lived signed URL and removes both the stored object and its database row.
- Adds migration \`20261118000100_songa_private_trip_document_storage.sql\` with a private bucket and owner-folder policies.

**Not implemented:** OCR, automatic boarding-pass extraction, receipt parsing or expense categorisation. The UI states this explicitly and does not invent seat numbers, merchant names or amounts.

### Songa AI in the Trip Workspace
- Replaces the embedded scripted, timeout-based chat response with a call to the existing \`songa-ai-assistant\` Edge Function.
- Sends the selected flight context and recent conversation messages.
- Shows a real service/configuration error when the Edge Function cannot return an answer.

The AI endpoint still requires its Supabase secrets, usage-control table and provider configuration. The user-facing answer is only as current as the supplied provider data.

### Responsive UI
- Keeps the current React application and its mobile navigation, rather than replacing it with the Bolt starter's standalone mock dashboard.
- Adds responsive styles for the private document list and rights-assessment cards.
- Retains the supplied Stitch assets as reference material. Not every Stitch screen has been converted into a complete working route yet.

## Existing Songa functionality retained from the 2.1 base

The branch retains the existing application architecture and source for:
- Supabase authentication and traveller account/profile.
- Provider-backed AeroAPI flight search through Supabase Edge Functions.
- Personal Flight Watch persistence in the current frontend watchlist model.
- Flight detail and disruption screens.
- Songa AI Edge Function and commerce catalogue.
- Existing PayPal order/capture/webhook functions and family/gift entitlements.
- Airport-services Sandbox catalogue.
- Accommodation search adapter (provider configuration required).
- WhatsApp companion and early-access flow.
- Flight position/global-map Edge Function (disabled by default).

Retaining a feature's source code does not mean its live provider, credentials, database migrations or operational workflow have been verified.

## Release blockers and work still required

### 1. Live booking inventory / Duffel
The current public website markets Duffel flight offers and the ability to continue to an airline. The accessible repository does not contain a Duffel search/offer/booking integration. The current flight search is operational flight-status lookup through AeroAPI, not a complete airfare shopping and ticketing flow.

**Required:** Duffel API credentials and a server-side integration for search, offer expiry/revalidation, passenger details, payment/booking creation, booking retrieval and cancellation/refund handling. Do not display "Duffel connected" or accept booking payment until this exists and has been tested.

### 2. Carpool, cargo and corporate travel
These are advertised on the public website, but this repository does not contain complete working modules, data models, provider/operator integrations or transaction flows for these services.

**Required:** product scope, operator/merchant onboarding, database models, pricing, availability, fulfilment and payment/settlement flows.

### 3. Flight Watch scheduled monitoring and notifications
The frontend persists watches using the current \`flight_watches\` / \`flights\` model. The existing \`whatsapp-alerts\` worker still queries the legacy \`watched_flights\` table and related snapshot schema. The migration notes explicitly say scheduled polling and notification delivery are not implemented by the base Flight Watch migration.

**Required:** inspect the live Supabase schema, reconcile the worker with the active watch schema, add an authenticated scheduled polling mechanism, implement idempotent event processing, and run end-to-end provider/notification tests. Do not enable scheduled WhatsApp alerts until this is complete.

### 4. Supabase deployment
No live Supabase project credentials were available in this build session. The new private-storage migration has been committed but **has not been applied** to the live project.

**Required:** back up the target schema, apply the new migration in a staging project first, test per-user upload/download/delete and confirm that one user cannot access another user's files, then promote the migration.

### 5. AI provider
The existing AI Edge Function requires at least one of \`GROQ_API_KEY\` or \`GEMINI_API_KEY\`, Supabase service-role configuration, the usage-limit table and rate-limit salt.

**Required:** set secrets in the Supabase Function environment and test both signed-in and guest usage, throttling, timeouts and provider fallback.

### 6. PayPal and airport marketplace
The current shared commerce engine and NBO airport services flow are documented as Sandbox. No production payment, refund, settlement to a physical airport merchant, stock synchronisation or pickup fulfilment was verified.

**Required:** configure the intended PayPal Live app and dedicated webhook IDs, run low-value capture/refund tests, onboard real airport merchants, and implement merchant settlement and operational fulfilment.

### 7. Merchant and super-admin workspaces
The Stitch export includes merchant operations and runner-console designs. The accessible React source does not yet contain complete merchant and super-admin workspaces with tenant isolation, role assignment, audit logs and secure server-side administration.

**Required:** approve the merchant/tenant model, define roles and a trusted admin bootstrap path, add RLS-protected schemas and server-validated operations, then build and test the workspaces. Hiding controls in the browser is not sufficient security.

### 8. AirHelp
The current code gates coverage from a configured country list; partner-supported countries and campaign tracking must come from the actual AirHelp/TradeTracker account.

**Required:** configure only confirmed countries, approved URLs and tracking parameters. An eligible route must not be described as a guaranteed claim.

### 9. Accommodation and weather
Accommodation search uses an adapter contract but requires a contracted supplier endpoint/token; the application does not have a live hotel booking/hold/confirm/refund flow. Weather requires a WeatherAPI secret and a complete consent/manual-location UI.

**Required:** configure providers and complete the corresponding end-to-end booking or location tests before advertising those capabilities as live.

### 10. WhatsApp and Flight Soundtrack
WhatsApp delivery requires a verified sender, Twilio secrets and the Flight Watch schema reconciliation above. The Flight Soundtrack screens exist in Stitch, but a production playback provider/OAuth integration is not verified.

**Required:** verify the sender/webhooks and implement a licensed OAuth-based playback integration. Do not host or stream unlicensed tracks.

### 11. Vercel / production deployment
This branch push does not itself deploy the production site. No Vercel project settings, production environment variables or domain deployment were changed in this session.

**Required:** connect a Vercel preview to this branch, configure the necessary public environment variables, run browser/device acceptance tests, then promote only after all applicable release gates pass.

## Verification status (18 November 2026)

- Repository source and the supplied design bundle inspected.
- New branch created from the newer 2.1 product-overhaul branch; \`main\` is not modified.
- New UK-rights logic and UI, private document-storage migration, file-upload handling and AI chat integration committed as source changes.
- GitHub Actions is configured to run \`npm ci\`, \`npm run typecheck\`, \`npm run lint\` and \`npm run build\` for this branch after the commit is pushed.
- Dependency-aware typecheck, lint and Vite build are **pending CI**; no live Supabase migration, live flight-provider call, PayPal transaction, WhatsApp delivery or Vercel production deployment has been performed here.

## Recommended next acceptance sequence

1. Review and apply the private-document migration to a staging Supabase project.
2. Verify upload, signed download and delete with two separate test users to prove storage isolation.
3. Run GitHub Actions and resolve any typecheck/lint/build failures before merging.
4. Reconcile \`flight_watches\` with the WhatsApp worker and implement scheduled polling plus alert deduplication.
5. Configure and test the actual live providers (AeroAPI, AI, Duffel, AirHelp and PayPal) with test journeys.
6. Implement the missing carpool, cargo, corporate, merchant and super-admin product areas.
7. Run mobile, tablet and desktop acceptance tests, then deploy a Vercel preview before production.

**Bottom line:** this branch is a stronger, more truthful Songa 2.5.0 engineering candidate built on the functional Songa codebase, not a claim that every advertised service or every Stitch screen is production complete. The remaining work above is explicit and must be closed before calling the platform production-ready.
