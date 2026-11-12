# Songa AI 2.0 — final release status (12 November 2026)

## Completed in this handoff

- Final source candidate assembled from the 12 November release archive.
- Homepage hierarchy simplified and responsive spacing/card treatment refined.
- AI commerce catalogue tool added; AI reads the server-side commerce catalogue and guides a user to secure checkout. Buyer approval remains mandatory.
- Separate `.env.sandbox.example` and `.env.live.example` for browser-safe Vercel configuration.
- Separate Supabase Edge Function secret templates for PayPal Sandbox and PayPal Live.
- Single PowerShell script to install, verify, typecheck, lint and build two mode-specific Vercel ZIPs.
- Judge/readiness matrix and hard limitations documented.
- MIT licence retained; no filled `.env` files or provider secrets included.

## Tests actually completed here

- Milestone 2 static source verification: **57 assertions passed**.
- Release ZIP contents checked: source, MIT licence, scripts and documentation included; `node_modules`, local `.env` files and previous build output excluded.

## Not completed / not claimed

- `npm ci` timed out in this environment; dependencies are incomplete.
- TypeScript, ESLint and Vite production build not verified in this environment.
- No browser or real-device visual tests completed.
- No Supabase database write/RLS test or migrations deployed.
- No PayPal Sandbox payment, webhook replay or refund test completed.
- No live PayPal activation or production Vercel deployment performed.

## Required next step

On a stable laptop, fill `.env.sandbox` and `.env.live` with the correct public Supabase URL and anon key for two separate Supabase projects, then run:

`Set-ExecutionPolicy -Scope Process Bypass; .\\BUILD-RELEASES.ps1`

The script creates `Songa-AI-2.0-Sandbox-Dist.zip` and `Songa-AI-2.0-Live-Dist.zip`. Deploy Sandbox first. Do not use Live credentials until the Sandbox acceptance tests pass.
