-- Store normalized delay values so the Live Desk can detect meaningful delay changes.
ALTER TABLE public.flight_snapshots
  ADD COLUMN IF NOT EXISTS departure_delay_minutes integer,
  ADD COLUMN IF NOT EXISTS arrival_delay_minutes integer;
