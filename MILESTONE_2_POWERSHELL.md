# Songa AI 2.0 — Milestone 2 PowerShell steps

Run these commands in **the extracted project root**, the folder that contains `package.json` (not inside `src` or `supabase`).

## 1. Extract and enter the project

If the ZIP is in Downloads:

```powershell
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\Songa-AI-2.0-Milestone-2-Source-Updated.zip" -DestinationPath "$env:USERPROFILE\Downloads\Songa-AI-2.0-Milestone-2" -Force
Set-Location "$env:USERPROFILE\Downloads\Songa-AI-2.0-Milestone-2"
Get-ChildItem package.json
```

The last command must show `package.json`. If it does not, enter the inner project folder containing it.

## 2. Install and validate

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run verify:milestone2
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Do not continue if any command fails. Send the complete first error block so it can be fixed before deployment.

## 3. Run the local app

```powershell
npm.cmd run dev
```

Open the local URL Vite prints. Check sign-in, flight search, saved Flight Watch, My Songa dashboard, Commerce products, gift/group forms, Airside cart, WhatsApp `SERVICES` and `MYSONGA` commands, and both theme settings at desktop and mobile widths.

## 4. Supabase and PayPal staging gate

Before applying the new Commerce migration:

1. Back up the existing Supabase project and inspect the live schema.
2. Review `supabase/migrations/20261109000100_songa_shared_commerce.sql` against the live project.
3. Review `20261111000100_songa_webhook_reliability.sql` and `20261112000100_songa_traveller_personalisation.sql`.
3. Configure the Supabase Edge Function secrets listed in `SUPABASE_DEPLOYMENT.md` using Sandbox PayPal credentials only.
4. Register the separate Sandbox webhook URL for `songa-commerce-webhook` and save its webhook ID as `PAYPAL_COMMERCE_WEBHOOK_ID`.
5. Apply only the reviewed migration; do not run `db reset` or blindly push all historical migrations.
6. Deploy the Commerce Edge Functions listed in `SUPABASE_DEPLOYMENT.md`.
7. Test a complete buyer flow for every product family, including cancellation, wrong amount/currency, duplicate capture, duplicate webhook, invalid signature, gift recipient mismatch, gift double-claim and family invitation/join.

Do not use live PayPal credentials or deploy to Vercel Production until all staging tests pass.
