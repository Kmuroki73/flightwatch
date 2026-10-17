/*
# Preserve useful saved-flight details

1. Modified Table
- `watched_flights` gains provider-returned display fields for the saved-flight view: airline, origin and destination city, displayed departure and arrival times, status, duration, terminal, and the provider update timestamp.

2. Data safety
- All new columns are nullable so existing saved rows remain valid.
- No rows are deleted, renamed, or type-changed.
- New values are supplied only from the verified search response in the application; ownership remains derived from the authenticated session.

3. Security
- Existing owner-scoped RLS policies remain in place.
- The new fields are covered by the existing row-level ownership checks.

4. Scope
- This change improves reload fidelity only. It does not activate background monitoring, polling, notifications, or disruption detection.
*/

ALTER TABLE public.watched_flights ADD COLUMN IF NOT EXISTS airline text;
ALTER TABLE public.watched_flights ADD COLUMN IF NOT EXISTS origin_city text;
ALTER TABLE public.watched_flights ADD COLUMN IF NOT EXISTS destination_city text;
ALTER TABLE public.watched_flights ADD COLUMN IF NOT EXISTS departure_time text;
ALTER TABLE public.watched_flights ADD COLUMN IF NOT EXISTS arrival_time text;
ALTER TABLE public.watched_flights ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.watched_flights ADD COLUMN IF NOT EXISTS duration text;
ALTER TABLE public.watched_flights ADD COLUMN IF NOT EXISTS terminal text;
ALTER TABLE public.watched_flights ADD COLUMN IF NOT EXISTS last_updated_at timestamptz;
