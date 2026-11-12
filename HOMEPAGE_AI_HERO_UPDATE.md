# Songa AI 2.0 — Homepage AI Hero Update

## What changed
- Added a first-screen `Ask Songa AI` composer to the homepage hero.
- Added three prompt suggestions for flight lookup, disruption guidance, and journey planning.
- Submitting the hero composer opens the existing Songa AI companion and automatically sends the exact prompt through the existing `songa-ai-assistant` Supabase Edge Function.
- Kept the existing flight-number search directly below the AI composer.
- Added responsive styling for desktop and mobile.
- Preserved the existing AI conversation, flight context, premium entitlement checks, and backend invocation path.

## Files changed
- `src/App.tsx`
- `src/index.css`

## Deployment notes
This is a frontend change. The already-deployed Supabase Edge Function does not need to be redeployed for this UI update. Build and deploy the frontend through the project's existing Vercel workflow after local checks pass.

The homepage composer calls the same Supabase function as the dedicated Songa AI screen. It does not display canned/example answers. If the Supabase frontend configuration is missing, the existing assistant error is shown instead of pretending the request succeeded.

## Verification
Run from the project root:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Then run `npm.cmd run dev`, open the homepage, enter a prompt in Ask Songa AI, and confirm it opens the companion and returns a backend-generated response. Do not commit until those checks pass.
