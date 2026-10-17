/*
# Create the isolated Songa Flight Watch data foundation

1. New Tables
- `watched_flights`: private flight watch records owned by the signed-in traveller, including flight number, journey date, route context, monitoring status, and timestamps.
- `flight_snapshots`: normalized provider snapshots associated with a traveller's watched flight, including supported schedule/status fields, provider source, source freshness, and retrieval time. This stores normalized fields only, not complete provider payloads.
- `disruption_events`: private change records for future monitoring, including the event type, previous and new normalized values, provider source time, detection time, and processing status.

2. Security
- Row Level Security is enabled on all three tables.
- Authenticated users can only read and manage records whose `user_id` matches `auth.uid()`.
- Ownership defaults to the authenticated session and is checked on inserts and updates.
- Anonymous users have no access to private flight records.

3. Integrity and performance
- Watched flights are unique per user, flight number, and travel date to prevent duplicates.
- Foreign keys connect snapshots and disruption events to watched flights and cascade when a watch is removed.
- Indexes support user-scoped watchlist, snapshot, and event queries.

4. Scope notes
- Scheduled polling, real-time monitoring, notification delivery, and AI-generated advice are not implemented by this migration.
- Provider credentials and raw provider payloads are intentionally excluded.
*/

CREATE TABLE IF NOT EXISTS public.watched_flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  flight_number text NOT NULL CHECK (length(trim(flight_number)) BETWEEN 2 AND 16),
  travel_date date NOT NULL,
  origin_code text CHECK (origin_code IS NULL OR origin_code ~ '^[A-Z0-9]{3,4}$'),
  destination_code text CHECK (destination_code IS NULL OR destination_code ~ '^[A-Z0-9]{3,4}$'),
  monitoring_status text NOT NULL DEFAULT 'active' CHECK (monitoring_status IN ('active', 'paused', 'expired')),
  provider_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flight_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  watched_flight_id uuid NOT NULL REFERENCES public.watched_flights(id) ON DELETE CASCADE,
  provider_flight_id text,
  flight_number text NOT NULL,
  travel_date date NOT NULL,
  origin_code text,
  destination_code text,
  scheduled_departure timestamptz,
  scheduled_arrival timestamptz,
  estimated_departure timestamptz,
  estimated_arrival timestamptz,
  actual_departure timestamptz,
  actual_arrival timestamptz,
  status text,
  terminal text,
  gate text,
  provider_source text NOT NULL,
  provider_last_updated_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  freshness_status text NOT NULL DEFAULT 'unknown' CHECK (freshness_status IN ('fresh', 'stale', 'unknown')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.disruption_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  watched_flight_id uuid NOT NULL REFERENCES public.watched_flights(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (length(trim(event_type)) BETWEEN 2 AND 80),
  previous_value jsonb,
  new_value jsonb,
  source_timestamp timestamptz,
  detected_at timestamptz NOT NULL DEFAULT now(),
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'ignored', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS watched_flights_user_journey_key
  ON public.watched_flights (user_id, lower(flight_number), travel_date);
CREATE INDEX IF NOT EXISTS watched_flights_user_status_idx
  ON public.watched_flights (user_id, monitoring_status, travel_date);
CREATE INDEX IF NOT EXISTS flight_snapshots_user_watch_idx
  ON public.flight_snapshots (user_id, watched_flight_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS disruption_events_user_watch_idx
  ON public.disruption_events (user_id, watched_flight_id, detected_at DESC);

ALTER TABLE public.watched_flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disruption_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watched_flights_select_own" ON public.watched_flights;
CREATE POLICY "watched_flights_select_own" ON public.watched_flights FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "watched_flights_insert_own" ON public.watched_flights;
CREATE POLICY "watched_flights_insert_own" ON public.watched_flights FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "watched_flights_update_own" ON public.watched_flights;
CREATE POLICY "watched_flights_update_own" ON public.watched_flights FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "watched_flights_delete_own" ON public.watched_flights;
CREATE POLICY "watched_flights_delete_own" ON public.watched_flights FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "flight_snapshots_select_own" ON public.flight_snapshots;
CREATE POLICY "flight_snapshots_select_own" ON public.flight_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "flight_snapshots_insert_own" ON public.flight_snapshots;
CREATE POLICY "flight_snapshots_insert_own" ON public.flight_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.watched_flights WHERE watched_flights.id = flight_snapshots.watched_flight_id AND watched_flights.user_id = auth.uid()));
DROP POLICY IF EXISTS "flight_snapshots_update_own" ON public.flight_snapshots;
CREATE POLICY "flight_snapshots_update_own" ON public.flight_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "flight_snapshots_delete_own" ON public.flight_snapshots;
CREATE POLICY "flight_snapshots_delete_own" ON public.flight_snapshots FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "disruption_events_select_own" ON public.disruption_events;
CREATE POLICY "disruption_events_select_own" ON public.disruption_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "disruption_events_insert_own" ON public.disruption_events;
CREATE POLICY "disruption_events_insert_own" ON public.disruption_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.watched_flights WHERE watched_flights.id = disruption_events.watched_flight_id AND watched_flights.user_id = auth.uid()));
DROP POLICY IF EXISTS "disruption_events_update_own" ON public.disruption_events;
CREATE POLICY "disruption_events_update_own" ON public.disruption_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "disruption_events_delete_own" ON public.disruption_events;
CREATE POLICY "disruption_events_delete_own" ON public.disruption_events FOR DELETE TO authenticated USING (auth.uid() = user_id);
