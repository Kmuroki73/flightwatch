# Flight Watch schema correction

The frontend previously queried `watched_flights`, a legacy table that is not present in the supplied live schema. The watchlist integration now targets `flight_watches` and embeds the related `flights` record.

The watch record uses these real fields: `user_id`, `flight_id`, `email_enabled`, `whatsapp_enabled`, `alert_on_delay`, `alert_on_cancellation`, `alert_on_diversion`, `alert_on_schedule_change`, `active`, `watched_at`, and `stopped_at`.

The app creates a `flights` row only when it cannot find one by provider flight ID or by flight identifier plus scheduled departure. It then creates a `flight_watches` row owned by the current authenticated user. Stopping a watch sets `active = false` and records `stopped_at`.

This correction is based on the table/column listing supplied by the user. That listing does not confirm foreign-key definitions, RLS policies, unique constraints, or table defaults. Verify those in Supabase before production release. A fresh Vite build and end-to-end tests have not been run in this environment because npm dependencies could not be installed.
