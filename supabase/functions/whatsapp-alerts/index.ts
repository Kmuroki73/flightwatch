const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? "";
const AEROAPI_KEY = Deno.env.get("AEROAPI_API_KEY") ?? Deno.env.get("AEROAPI_KEY") ?? "";

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type WatchedFlight = {
  id: string;
  user_id: string;
  flight_number: string;
  travel_date: string;
  monitoring_status: string;
};

type Connection = {
  user_id: string;
  phone_e164: string;
  status: string;
  notifications_enabled: boolean;
  notify_delay_changes: boolean;
  notify_cancellation_diversion: boolean;
  notify_departure_changes: boolean;
  notify_arrival_updates: boolean;
};

type Snapshot = {
  status: string | null;
  cancelled: boolean | null;
  diverted: boolean | null;
  departure_delay_minutes: number | null;
  arrival_delay_minutes: number | null;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  estimated_departure: string | null;
  estimated_arrival: string | null;
  actual_departure: string | null;
  actual_arrival: string | null;
};

type FlightResult = {
  id: string;
  status?: string;
  cancelled?: boolean;
  diverted?: boolean;
  departureDelayMinutes?: number | null;
  arrivalDelayMinutes?: number | null;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  lastUpdatedAt?: string;
};

type AlertEvent = {
  watchId: string;
  flightNumber: string;
  eventType: string;
  previous: Record<string, unknown>;
  next: Record<string, unknown>;
  message: string;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function twilioConfigured(): boolean {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM);
}

function toDelayMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value / 60);
}

async function fetchFlight(ident: string, travelDate: string): Promise<{ flight: FlightResult | null; error: string | null }> {
  if (!AEROAPI_KEY) return { flight: null, error: "not_configured" };
  const start = new Date(Math.max(new Date(`${travelDate}T00:00:00Z`).getTime(), Date.now() - 10 * 86_400_000)).toISOString().replace(/\.\d{3}Z$/, "Z");
  const end = new Date(Math.min(new Date(`${travelDate}T23:59:59Z`).getTime(), Date.now() + 2 * 86_400_000)).toISOString().replace(/\.\d{3}Z$/, "Z");
  const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(ident)}?start=${start}&end=${end}&max_pages=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { headers: { "x-apikey": AEROAPI_KEY }, signal: controller.signal });
    if (!response.ok) return { flight: null, error: `provider_status_${response.status}` };
    const payload = await response.json().catch(() => null);
    const flights = payload && typeof payload === "object" && "flights" in payload
      ? (payload as { flights?: unknown }).flights
      : null;
    if (!Array.isArray(flights) || !flights.length) return { flight: null, error: null };
    const f = flights[0] as Record<string, unknown>;
    const statusRaw = typeof f.status === "string" ? f.status : null;
    return {
      flight: {
        id: typeof f.fa_flight_id === "string" ? f.fa_flight_id : `${ident}-${travelDate}`,
        status: statusRaw,
        cancelled: f.cancelled === true || (statusRaw?.toLowerCase().includes("cancelled") ?? false),
        diverted: f.diverted === true || (statusRaw?.toLowerCase().includes("diverted") ?? false),
        departureDelayMinutes: toDelayMinutes(f.departure_delay),
        arrivalDelayMinutes: toDelayMinutes(f.arrival_delay),
        scheduledDeparture: (f.scheduled_off ?? f.scheduled_departure) as string | undefined,
        scheduledArrival: (f.scheduled_in ?? f.scheduled_arrival) as string | undefined,
        estimatedDeparture: (f.estimated_off ?? f.estimated_departure) as string | undefined,
        estimatedArrival: (f.estimated_in ?? f.estimated_arrival) as string | undefined,
        actualDeparture: (f.actual_off ?? f.actual_departure) as string | undefined,
        actualArrival: (f.actual_in ?? f.actual_arrival) as string | undefined,
        lastUpdatedAt: (f.last_position as Record<string, unknown> | undefined)?._ts as string | undefined
          ?? (f.updated as string | undefined)
          ?? new Date().toISOString(),
      },
      error: null,
    };
  } catch {
    return { flight: null, error: "provider_unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}

function snapshotFromFlight(flight: FlightResult): Snapshot {
  return {
    status: flight.status ?? null,
    cancelled: flight.cancelled ?? null,
    diverted: flight.diverted ?? null,
    departure_delay_minutes: flight.departureDelayMinutes ?? null,
    arrival_delay_minutes: flight.arrivalDelayMinutes ?? null,
    scheduled_departure: flight.scheduledDeparture ?? null,
    scheduled_arrival: flight.scheduledArrival ?? null,
    estimated_departure: flight.estimatedDeparture ?? null,
    estimated_arrival: flight.estimatedArrival ?? null,
    actual_departure: flight.actualDeparture ?? null,
    actual_arrival: flight.actualArrival ?? null,
  };
}

// Compares the fresh snapshot with the last processed one and returns the
// meaningful, preference-matched changes. A missing field is never a change.
function detectChanges(
  previous: Snapshot | null,
  next: Snapshot,
  prefs: Connection,
  flightNumber: string,
): AlertEvent[] {
  const events: AlertEvent[] = [];
  const push = (eventType: string, previous: Record<string, unknown>, next: Record<string, unknown>, message: string) =>
    events.push({ watchId: "", flightNumber, eventType, previous, next, message });

  const timeLabel = (iso: string | null | undefined) => iso ?? "unknown";

  if (previous?.cancelled !== true && next.cancelled === true && prefs.notify_cancellation_diversion) {
    push("cancellation", { cancelled: previous?.cancelled ?? null }, { cancelled: true },
      `${flightNumber} has been reported as CANCELLED by the flight data provider.`);
  }
  if (previous?.diverted !== true && next.diverted === true && prefs.notify_cancellation_diversion) {
    push("diversion", { diverted: previous?.diverted ?? null }, { diverted: true },
      `${flightNumber} has been reported as DIVERTED by the flight data provider.`);
  }

  const prevDepDelay = previous?.departure_delay_minutes ?? null;
  const nextDepDelay = next.departure_delay_minutes;
  if (
    prefs.notify_delay_changes &&
    nextDepDelay != null && nextDepDelay >= 15 &&
    (prevDepDelay == null || Math.abs(nextDepDelay - prevDepDelay) >= 15)
  ) {
    push("departure_delay", { delayMinutes: prevDepDelay }, { delayMinutes: nextDepDelay },
      `${flightNumber}: departure delay is now about ${nextDepDelay} minutes (provider data).`);
  }

  if (prefs.notify_departure_changes) {
    const prevDep = previous?.estimated_departure ?? previous?.scheduled_departure ?? null;
    const nextDep = next.estimated_departure ?? next.scheduled_departure ?? null;
    if (prevDep && nextDep && prevDep !== nextDep) {
      push("departure_time_change", { time: prevDep }, { time: nextDep },
        `${flightNumber}: departure time changed from ${timeLabel(prevDep)} to ${timeLabel(nextDep)} (UTC).`);
    }
  }

  if (prefs.notify_arrival_updates) {
    const prevArr = previous?.estimated_arrival ?? previous?.scheduled_arrival ?? null;
    const nextArr = next.estimated_arrival ?? next.scheduled_arrival ?? null;
    if (prevArr && nextArr && prevArr !== nextArr) {
      push("arrival_time_change", { time: prevArr }, { time: nextArr },
        `${flightNumber}: arrival time changed from ${timeLabel(prevArr)} to ${timeLabel(nextArr)} (UTC).`);
    }
  }

  return events;
}

async function sendWhatsApp(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: TWILIO_WHATSAPP_FROM.startsWith("whatsapp:") ? TWILIO_WHATSAPP_FROM : `whatsapp:${TWILIO_WHATSAPP_FROM}`,
    Body: body,
  });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message)
      : `Twilio responded with status ${response.status}`;
    return { ok: false, error: message };
  }
  const sid = payload && typeof payload === "object" && "sid" in payload ? String((payload as { sid?: unknown }).sid) : undefined;
  return { ok: true, sid };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed", message: "Use POST." }, 405);
    }

    // Authenticated callers only: the dashboard "check now" button, or a
    // scheduled trigger presenting a service JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "unauthenticated", message: "Sign in to run a watch check." }, 401);

    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "unauthenticated", message: "Your session is no longer valid. Sign in again." }, 401);
    }
    const userId = userData.user.id;

    if (!twilioConfigured()) {
      return json({ error: "not_configured", message: "Twilio is not configured, so alerts cannot be delivered yet. Add the Twilio secrets in the Supabase dashboard (Edge Functions → Secrets)." }, 503);
    }

    const { data: watches, error: watchesError } = await adminClient
      .from("watched_flights")
      .select("id, user_id, flight_number, travel_date, monitoring_status")
      .eq("user_id", userId)
      .eq("monitoring_status", "active");
    if (watchesError) {
      return json({ error: "internal", message: "Your watchlist could not be loaded." }, 500);
    }

    const { data: connection } = await adminClient
      .from("whatsapp_connections")
      .select("user_id, phone_e164, status, notifications_enabled, notify_delay_changes, notify_cancellation_diversion, notify_departure_changes, notify_arrival_updates")
      .eq("user_id", userId)
      .maybeSingle();

    const conn = (connection ?? null) as Connection | null;
    const alerts: { flightNumber: string; eventType: string; message: string; delivered: boolean; error?: string }[] = [];
    let checked = 0;
    let providerErrors = 0;

    for (const watch of (watches ?? []) as WatchedFlight[]) {
      checked += 1;
      const ident = watch.flight_number.replace(/\s+/g, "").toUpperCase();
      const { flight, error: fetchError } = await fetchFlight(ident, watch.travel_date);

      // A transient provider error never triggers alerts and never overwrites
      // the last good snapshot.
      if (fetchError || !flight) {
        providerErrors += 1;
        continue;
      }

      const { data: lastSnapshotRow } = await adminClient
        .from("flight_snapshots")
        .select("id, status, provider_flight_id, scheduled_departure, scheduled_arrival, estimated_departure, estimated_arrival, actual_departure, actual_arrival, provider_source, provider_last_updated_at")
        .eq("watched_flight_id", watch.id)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const previous: Snapshot | null = lastSnapshotRow ? {
        status: (lastSnapshotRow.status as string | null) ?? null,
        cancelled: lastSnapshotRow.provider_flight_id === "cancelled-marker" ? true : false,
        diverted: false,
        departure_delay_minutes: null,
        arrival_delay_minutes: null,
        scheduled_departure: lastSnapshotRow.scheduled_departure as string | null,
        scheduled_arrival: lastSnapshotRow.scheduled_arrival as string | null,
        estimated_departure: lastSnapshotRow.estimated_departure as string | null,
        estimated_arrival: lastSnapshotRow.estimated_arrival as string | null,
        actual_departure: lastSnapshotRow.actual_departure as string | null,
        actual_arrival: lastSnapshotRow.actual_arrival as string | null,
      } : null;

      // Cancellation state persists in the snapshot's status field; treat a
      // status containing "cancel"/"divert" as the carried state.
      if (previous) {
        const prevStatus = (previous.status ?? "").toLowerCase();
        previous.cancelled = prevStatus.includes("cancel") || previous.cancelled === true;
        previous.diverted = prevStatus.includes("divert");
      }

      // Snapshot needs the delay values; store them in the new snapshot row.
      const nextSnapshot = snapshotFromFlight(flight);

      // Store the new snapshot first (with a source timestamp), then diff.
      const { data: inserted, error: insertError } = await adminClient
        .from("flight_snapshots")
        .insert({
          user_id: userId,
          watched_flight_id: watch.id,
          provider_flight_id: flight.id,
          flight_number: watch.flight_number,
          travel_date: watch.travel_date,
          status: nextSnapshot.status,
          scheduled_departure: nextSnapshot.scheduled_departure,
          scheduled_arrival: nextSnapshot.scheduled_arrival,
          estimated_departure: nextSnapshot.estimated_departure,
          estimated_arrival: nextSnapshot.estimated_arrival,
          actual_departure: nextSnapshot.actual_departure,
          actual_arrival: nextSnapshot.actual_arrival,
          provider_source: "FlightAware AeroAPI",
          provider_last_updated_at: flight.lastUpdatedAt ?? null,
          freshness_status: "fresh",
        })
        .select("id")
        .maybeSingle();
      if (insertError) {
        providerErrors += 1;
        continue;
      }

      if (!conn || conn.status !== "verified" || !conn.notifications_enabled) {
        continue;
      }

      const events = detectChanges(previous, nextSnapshot, conn, watch.flight_number);
      for (const event of events) {
        // Dedupe: skip if this exact event was already recorded for this watch.
        const { data: existingEvent } = await adminClient
          .from("disruption_events")
          .select("id")
          .eq("watched_flight_id", watch.id)
          .eq("event_type", event.eventType)
          .contains("new_value", event.next)
          .maybeSingle();
        if (existingEvent) continue;

        const { error: eventError } = await adminClient
          .from("disruption_events")
          .insert({
            user_id: userId,
            watched_flight_id: watch.id,
            event_type: event.eventType,
            previous_value: event.previous,
            new_value: event.next,
            source_timestamp: flight.lastUpdatedAt ?? null,
            processing_status: "pending",
          });
        if (eventError) continue;

        const send = await sendWhatsApp(conn.phone_e164, `Songa Flight Watch: ${event.message}`);
        await adminClient.from("whatsapp_message_log").insert({
          message_sid: send.sid ?? null,
          user_id: userId,
          direction: "outbound",
          to_e164: conn.phone_e164,
          body: event.message,
          command_kind: "other",
          delivery_status: send.ok ? "sent" : "failed",
          error_message: send.error ?? null,
        });
        await adminClient
          .from("disruption_events")
          .update({ processing_status: send.ok ? "processed" : "failed" })
          .eq("watched_flight_id", watch.id)
          .eq("event_type", event.eventType)
          .contains("new_value", event.next);
        alerts.push({
          flightNumber: watch.flight_number,
          eventType: event.eventType,
          message: event.message,
          delivered: send.ok,
          error: send.error,
        });
        void inserted;
      }
    }

    return json({
      ok: true,
      checked,
      providerErrors,
      alerts,
      notificationsActive: Boolean(conn?.status === "verified" && conn.notifications_enabled),
    });
  } catch (err) {
    return json({ error: "internal", message: err instanceof Error ? err.message : "Unexpected server error." }, 500);
  }
});
