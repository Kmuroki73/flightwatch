# Songa AI 2.0 — PowerShell quick start

## One-command release build

1. Copy `.env.sandbox.example` to `.env.sandbox` and add the Sandbox Supabase URL + anon key.
2. Copy `.env.live.example` to `.env.live` and add the Live Supabase URL + anon key.
3. Open PowerShell in this folder and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass; .\BUILD-RELEASES.ps1
```

This installs dependencies once, runs the static milestone check, TypeScript, ESLint and then builds both deployable Vite bundles. It outputs:

- `Songa-AI-2.0-Sandbox-Dist.zip`
- `Songa-AI-2.0-Live-Dist.zip`

The two Supabase projects must be separate if the two deployments are to use Sandbox and Live PayPal simultaneously. Configure provider and PayPal credentials in each project's Supabase Edge Function secrets using `supabase/.env.sandbox.example` and `supabase/.env.live.example` as checklists.

## If PowerShell blocks npm

Use `npm.cmd`, not `npm`. The release script already does this.

## Laptop power

A phone charger may not provide the wattage/USB-PD profile required by the laptop. Use the laptop's rated charger if possible. Avoid repeated forced restarts while it is overheating or losing power.
