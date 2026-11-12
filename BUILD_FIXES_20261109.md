# Songa 2.0 — build/typecheck/lint fixes (9 November 2026)

## What your first PowerShell run confirmed

- `npm.cmd ci --no-audit --no-fund` installed 288 packages successfully.
- `npm.cmd run build` completed successfully with Vite 5.4.8 and transformed 1,655 modules.
- The initial typecheck reported 7 errors: 4 nullable Supabase client references in `src/App.tsx`, and 3 ES2020 `String.replaceAll` library errors in `CommerceScreen.tsx`.
- The initial ESLint run reported 14 errors: unused imports, explicit `any` in four Supabase function files, and one unused ESLint suppression warning.

## Changes in this update

1. `src/App.tsx`
   - Capture the optional Supabase client in a stable local constant and use it after a null guard in the flight-position and premium-entitlement effects.
   - Add the correct effect dependencies for the premium-entitlement lookup.
   - Remove unused `MapPin` and `Timer` imports.
2. `src/screens/CommerceScreen.tsx`
   - Remove five unused icon imports.
   - Replace `replaceAll` with ES2020-compatible global regular-expression replacements.
3. `supabase/functions/_shared/commerce.ts`
   - Replace the explicit `any` order parameter with a typed `CommerceOrder` shape.
4. `supabase/functions/songa-commerce-capture-order/index.ts`
   - Parse PayPal capture JSON through a safe `unknown`-to-record helper and validate nested values before use.
5. `supabase/functions/songa-commerce-webhook/index.ts`
   - Remove explicit `any` event/resource records and safely read nested webhook data.
6. `supabase/functions/songa-group-add-flight/index.ts`
   - Remove explicit `any` flight payload types and validate nested origin/destination values.
7. `src/screens/AirportBoard.tsx`
   - Memoise the loader with `useCallback` and remove an obsolete eslint suppression.

## Validation status

- A TypeScript 5.8.3 syntax/transpilation pass parsed 35 TS/TSX source and Edge Function files with no syntax/transpilation diagnostics.
- The dependency-aware `npm run typecheck`, ESLint and Vite build have NOT yet been rerun against this patched package. The user should run them locally using the already-installed dependencies.
- Your previous Vite build succeeded before these source fixes. Rebuilding after applying the patch should produce the updated production `dist`.

## Apply without reinstalling packages

Extract `Songa-AI-2.0-Build-Fixes.zip` directly into the existing Songa project folder, choosing overwrite/replace. It contains only the changed source files and this note. Do not run `npm ci` again if `node_modules` is still present. Then run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

The npm 11 message about `esbuild@0.21.5` install-script approval is a separate warning. Your previous Vite build completed despite it. Do not disable package-script protections globally; if npm reports the esbuild binary missing, inspect the pending script with `npm.cmd install-scripts ls` and approve only the expected `esbuild@0.21.5` script if you are satisfied it is the locked dependency.
