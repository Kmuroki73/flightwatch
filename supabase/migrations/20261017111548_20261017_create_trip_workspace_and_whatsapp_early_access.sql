/*
# Create the Travel Copilot workspace storage and WhatsApp early-access list

1. New Tables
- `trip_documents`: private documents in a traveller's Trip Workspace vault. Each row is either a boarding pass (seat number, boarding group, cabin class, route context) or a receipt (merchant, total, currency, category, file name). Documents are created through the dashboard vault.
- `whatsapp_early_access`: public early-access signups for the WhatsApp Flight Companion (email only). No authentication required to join the waitlist; the list is readable only by its owner.

2. Security
- Row Level Security is enabled on both tables.
- `trip_documents` is owner-scoped: authenticated users can only read and manage rows whose user_id matches auth.uid(); the owner column defaults to the session so inserts from the dashboard succeed.
- `whatsapp_early_access` allows anonymous and authenticated inserts (a waitlist must accept visitors who have not signed in) but no public reads; each visitor can read only their own submissions.

3. Integrity and performance
- Documents are linked to a flight number and optional travel date for trip context.
- Indexes support user-scoped vault queries and waitlist lookups.

4. Scope notes
- No notification delivery is built by this migration. WhatsApp delivery remains disabled until the Cloud API sender and webhook are configured and verified.
*/

CREATE TABLE IF NOT EXISTS public.trip_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('boarding_pass', 'receipt')),
  flight_number text,
  travel_date date,
  seat_number text,
  boarding_group text,
  cabin_class text,
  merchant text,
  total_amount numeric,
  currency text,
  category text,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_early_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_early_access_email_key
  ON public.whatsapp_early_access (lower(email));
CREATE INDEX IF NOT EXISTS trip_documents_user_kind_idx
  ON public.trip_documents (user_id, kind, created_at DESC);

ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_early_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_documents_select_own" ON public.trip_documents;
CREATE POLICY "trip_documents_select_own" ON public.trip_documents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "trip_documents_insert_own" ON public.trip_documents;
CREATE POLICY "trip_documents_insert_own" ON public.trip_documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "trip_documents_update_own" ON public.trip_documents;
CREATE POLICY "trip_documents_update_own" ON public.trip_documents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "trip_documents_delete_own" ON public.trip_documents;
CREATE POLICY "trip_documents_delete_own" ON public.trip_documents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "whatsapp_early_access_insert_public" ON public.whatsapp_early_access;
CREATE POLICY "whatsapp_early_access_insert_public" ON public.whatsapp_early_access FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "whatsapp_early_access_select_own" ON public.whatsapp_early_access;
CREATE POLICY "whatsapp_early_access_select_own" ON public.whatsapp_early_access FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
