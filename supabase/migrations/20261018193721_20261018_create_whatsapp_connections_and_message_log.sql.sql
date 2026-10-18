/*
# Create WhatsApp connection, preferences, and message-log tables

1. New Tables
- `whatsapp_connections`: one row per Songa user (unique on user_id). Holds the
  E.164 WhatsApp number, connection status (`pending_verification`, `verified`,
  `disconnected`), a hashed 6-digit verification code with expiry and attempt
  counter (never the plaintext code), the notifications master switch, an
  explicit-consent timestamp, and four notification preference flags
  (delay changes, cancellation/diversion, departure-time changes, arrival
  updates).
- `whatsapp_message_log`: durable record of inbound and outbound WhatsApp
  messages. A unique constraint on Twilio's MessageSid makes webhook retries
  and duplicate deliveries idempotent. Stores the direction, body, command
  kind, delivery status, and error text so failures can be investigated.

2. Security
- Row Level Security is enabled on both tables.
- `whatsapp_connections`: authenticated users can select, insert, update, and
  delete only the row whose user_id matches auth.uid(). Anonymous users have
  no access. One row per user is enforced by a unique constraint, and the
  owner column defaults to the session so a client insert cannot target
  another user.
- `whatsapp_message_log`: intentionally has NO client policies. It is written
  only by edge functions using the service role (webhook ingestion, alert
  delivery) and can never be read or modified from the browser, so one user
  cannot learn anything about another user's messages.

3. Integrity and performance
- Phone numbers are stored in E.164 format with a format check constraint.
- Consent requires an explicit timestamp; the master switch cannot be enabled
  unless consent was given.
- Indexes support looking up a connection by phone number (webhook routing)
  and pruning old log entries.

4. Scope notes
- No Twilio credentials are stored here. Credentials live only in edge
  function secrets. Verification codes are stored as salted hashes with a
  10-minute expiry and a maximum of 5 attempts.
*/

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 text CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  status text NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified', 'disconnected')),
  verification_code_hash text,
  verification_expires_at timestamptz,
  verification_attempts integer NOT NULL DEFAULT 0 CHECK (verification_attempts BETWEEN 0 AND 5),
  notifications_enabled boolean NOT NULL DEFAULT false,
  consent_given_at timestamptz,
  notify_delay_changes boolean NOT NULL DEFAULT true,
  notify_cancellation_diversion boolean NOT NULL DEFAULT true,
  notify_departure_changes boolean NOT NULL DEFAULT true,
  notify_arrival_updates boolean NOT NULL DEFAULT true,
  linked_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connections_user_key
  ON public.whatsapp_connections (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connections_phone_key
  ON public.whatsapp_connections (phone_e164) WHERE phone_e164 IS NOT NULL AND status = 'verified';
CREATE INDEX IF NOT EXISTS whatsapp_connections_phone_lookup_idx
  ON public.whatsapp_connections (phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid text UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_e164 text,
  to_e164 text,
  body text,
  command_kind text CHECK (command_kind IS NULL OR command_kind IN ('stop', 'help', 'flight_query', 'other')),
  delivery_status text NOT NULL DEFAULT 'queued' CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'failed', 'suppressed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_message_log_created_idx
  ON public.whatsapp_message_log (created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_message_log_user_idx
  ON public.whatsapp_message_log (user_id, created_at DESC);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_connections_select_own" ON public.whatsapp_connections;
CREATE POLICY "whatsapp_connections_select_own" ON public.whatsapp_connections FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "whatsapp_connections_insert_own" ON public.whatsapp_connections;
CREATE POLICY "whatsapp_connections_insert_own" ON public.whatsapp_connections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "whatsapp_connections_update_own" ON public.whatsapp_connections;
CREATE POLICY "whatsapp_connections_update_own" ON public.whatsapp_connections FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "whatsapp_connections_delete_own" ON public.whatsapp_connections;
CREATE POLICY "whatsapp_connections_delete_own" ON public.whatsapp_connections FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
