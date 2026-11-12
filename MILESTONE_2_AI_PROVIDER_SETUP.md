# Songa AI provider setup

The `songa-ai-assistant` Edge Function now supports Groq as primary and Gemini as fallback. It uses a shared internal tool-call format and executes Songa tools only in the Edge Function. Provider fallback occurs only when a model API request fails; tool execution and payment operations are never automatically replayed through another provider.

## Supabase Edge Function secrets

Required (at least one):
- `GROQ_API_KEY`
- `GEMINI_API_KEY`

Optional model overrides:
- `GROQ_MODEL` (default `openai/gpt-oss-20b`)
- `GEMINI_MODEL` (default `gemini-2.5-flash`)

Remove the old `OPENAI_API_KEY` / `OPENAI_MODEL` dependency for this function; they are no longer read. Do not put provider keys in Vite/client environment variables.

## Deploy

From the project root:

```powershell
supabase functions deploy songa-ai-assistant
```

Then test the deployed function with a signed-in app session. Confirm the response includes `provider` and `model`. To test fallback safely, temporarily revoke/replace the Groq key in a staging project, verify Gemini responds, then restore the valid key. Do not deliberately break production secrets during a live demo.

## Important limitations

- The current implemented tool remains `search_flight`. Alternative-flight booking and AI-prepared PayPal checkout are not added by this provider switch.
- Gemini free-tier data handling may differ from paid terms; avoid sending sensitive personal or payment data to free-tier inference.
- Both providers have quotas/rate limits. This is failover, not an uptime guarantee.
