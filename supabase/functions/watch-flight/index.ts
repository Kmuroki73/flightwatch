
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function validTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateOnly(value: string | null, fallback: string): string {
  return value ? value.slice(0, 10) : fallback.slice(0, 10);
}

function displayRow(watch: any, flight: any) {
  const departure = flight.scheduled_departure ?? null;
  const arrival = flight.scheduled_arrival ?? null;
  const now = new Date().toISOString();

  return {
    id: watch.id,
    user_id: watch.user_id,
    flight_number: flight.ident,
    travel_date: dateOnly(departure ?? arrival, watch.watched_at),
    origin_code: flight.origin,
    destination_code: flight.destination,
    monitoring_status: watch.active ? "active" : "paused",
    provider_source: flight.provider,
    airline: null,
    origin_city: null,
    destination_city: null,
    departure_time: departure,
    arrival_time: arrival,
    status: flight.status,
    duration: null,
    terminal: null,
    last_updated_at:
      flight.last_provider_update ?? flight.last_checked_at ?? null,
    created_at: watch.watched_at ?? now,
    updated_at: flight.updated_at ?? now,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405);
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return respond({ error: "Server configuration is incomplete." }, 500);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return respond({ error: "Please sign in first." }, 401);
    }

    const { data: authData, error: authError } =
      await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return respond({ error: "Your session is invalid. Please sign in again." }, 401);
    }

    const userId = authData.user.id;
    const body = await req.json();
    const operation = body?.operation;

    if (operation === "list") {
      const { data, error } = await admin
        .from("flight_watches")
        .select(`
          id, user_id, active, watched_at, stopped_at,
          flight:flights!flight_watches_flight_id_fkey (
            id, provider, provider_flight_id, ident, origin, destination,
            scheduled_departure, scheduled_arrival, status, delay_minutes,
            diverted, cancelled, last_provider_update, last_checked_at,
            updated_at
          )
        `)
        .eq("user_id", userId)
        .eq("active", true)
        .order("watched_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? [])
        .filter((item: any) => item.flight)
        .map((item: any) => {
          const flight = Array.isArray(item.flight)
            ? item.flight[0]
            : item.flight;
          return displayRow(item, flight);
        });

      return respond({ rows });
    }

    if (operation === "add") {
      const flight = body?.flight;

      if (!flight || typeof flight !== "object") {
        return respond({ error: "Flight details are required." }, 400);
      }

      if (flight.dataMode !== "live") {
        return respond(
          { error: "Only live flight results can be added to your watchlist." },
          400,
        );
      }

      const ident =
        typeof flight.flightNumber === "string"
          ? flight.flightNumber.trim().toUpperCase().replace(/\s+/g, "")
          : "";

      const providerFlightId =
        typeof flight.providerFlightId === "string" &&
        flight.providerFlightId.trim()
          ? flight.providerFlightId.trim()
          : typeof flight.id === "string"
            ? flight.id.trim()
            : "";

      if (
        !ident ||
        !providerFlightId ||
        typeof flight.origin?.code !== "string" ||
        typeof flight.destination?.code !== "string"
      ) {
        return respond({ error: "The flight details are incomplete." }, 400);
      }

      const scheduledDeparture = validTimestamp(flight.scheduledDeparture);
      const scheduledArrival = validTimestamp(flight.scheduledArrival);
      const lastProviderUpdate = validTimestamp(flight.lastUpdatedAt);

      const { data: savedFlight, error: flightError } = await admin
        .from("flights")
        .upsert(
          {
            provider: "flightaware",
            provider_flight_id: providerFlightId,
            ident,
            
          {
            provider: "flightaware",
            provider_flight_id: providerFlightId,
            ident,

            // Additional flight details
            airline: flight.airline ?? null,
            airline_code: flight.airlineCode ?? null,
            origin_city: flight.origin.city ?? null,
            destination_city: flight.destination.city ?? null,
            duration: flight.duration ?? null,
            terminal: flight.terminal ?? null,
            gate: flight.gate ?? null,
            aircraft: flight.aircraft ?? null,
            aircraft_registration: flight.aircraftRegistration ?? null,

            origin: flight.origin.code,
            destination: flight.destination.code,
            scheduled_departure: scheduledDeparture,
            scheduled_arrival: scheduledArrival,
            estimated_departure: validTimestamp(flight.estimatedDeparture),
            estimated_arrival: validTimestamp(flight.estimatedArrival),
            actual_departure: validTimestamp(flight.actualDeparture),
            actual_arrival: validTimestamp(flight.actualArrival),
            status: flight.status ?? "Unknown",
            delay_minutes:

              typeof flight.departureDelayMinutes === "number"
                ? flight.departureDelayMinutes
                : typeof flight.arrivalDelayMinutes === "number"
                  ? flight.arrivalDelayMinutes
                  : null,
            diverted: flight.disruption === "diverted",
            cancelled: flight.disruption === "cancelled",
            last_provider_update: lastProviderUpdate,
            last_checked_at: new Date().toISOString(),
          },
          { onConflict: "provider,provider_flight_id" },
        )
        .select("id")
        .single();

      if (flightError) throw flightError;

      const { data: savedWatch, error: watchError } = await admin
        .from("flight_watches")
        .upsert(
          {
            user_id: userId,
            flight_id: savedFlight.id,
            active: true,
            stopped_at: null,
          },
          { onConflict: "user_id,flight_id" },
        )
        .select(`
          id, user_id, active, watched_at, stopped_at,
          flight:flights!flight_watches_flight_id_fkey (
            id, provider, provider_flight_id, ident, origin, destination,
            scheduled_departure, scheduled_arrival, status, delay_minutes,
            diverted, cancelled, last_provider_update, last_checked_at,
            updated_at
          )
        `)
        .single();

      if (watchError) throw watchError;

      const savedFlightData = Array.isArray(savedWatch.flight)
        ? savedWatch.flight[0]
        : savedWatch.flight;

      return respond({ row: displayRow(savedWatch, savedFlightData) });
    }

    if (operation === "remove") {
      const id = body?.id;

      if (typeof id !== "string" || !id.trim()) {
        return respond({ error: "A watch ID is required." }, 400);
      }

      const { data, error } = await admin
        .from("flight_watches")
        .update({
          active: false,
          stopped_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .eq("active", true)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return respond({ error: "The active watch was not found." }, 404);
      }

      return respond({ success: true });
    }

    return respond({ error: "Unknown watchlist operation." }, 400);
  } catch (error) {
    console.error("watch-flight error:", error);
    return respond({ error: "The watchlist operation failed. Please try again." }, 500);
  }
});

