const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type SearchBody = {
  flightNumber?: string;
  airport?: string;
  direction?: "departures" | "arrivals";
  travelDate?: string;
};

const AEROAPI_BASE = "https://aeroapi.flightaware.com/aeroapi";
const AEROAPI_KEY = Deno.env.get("AEROAPI_API_KEY") ?? Deno.env.get("AEROAPI_KEY");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed", message: "Use POST." }, 405);
    }

    if (!AEROAPI_KEY) {
      return json({ error: "not_configured", message: "AEROAPI_API_KEY secret is not set. Flight data is unavailable until the provider key is added." }, 503);
    }

    let body: SearchBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_request", message: "Body must be valid JSON." }, 400);
    }

    const wantsBoard = typeof body.airport === "string" && body.airport.trim().length > 0;
    const wantsFlight = typeof body.flightNumber === "string" && body.flightNumber.trim().length > 0;
    if (wantsBoard === wantsFlight) {
      return json({ error: "invalid_request", message: "Provide exactly one of flightNumber or airport." }, 400);
    }

    const travelDate = sanitizeDate(body.travelDate);
    if (body.travelDate && !travelDate) {
      return json({ error: "invalid_request", message: "travelDate must be a valid date (YYYY-MM-DD)." }, 400);
    }

    if (wantsFlight) {
      return await handleFlightSearch(body.flightNumber!.trim().toUpperCase(), travelDate);
    }
    return await handleAirportBoard(body.airport!.trim().toUpperCase(), body.direction === "arrivals" ? "arrivals" : "departures", travelDate);
  } catch (err) {
    return json({ error: "internal", message: err instanceof Error ? err.message : "Unexpected server error." }, 500);
  }
});

async function handleFlightSearch(flightNumber: string, travelDate: string | null): Promise<Response> {
  const ident = flightNumber.replace(/\s+/g, "");
  if (!/^[A-Z0-9]{2,8}$/.test(ident) || !/[A-Z]/.test(ident) || !/\d/.test(ident)) {
    return json({ error: "invalid_request", message: "flightNumber must be an airline code followed by a number, e.g. KQ100." }, 400);
  }

  // AeroAPI's ident endpoint supports an explicit ISO8601 `start`/`end` window
  // (start max 10 days in the past, end max 2 days in the future) plus
  // `max_pages`. `end_offset` is not a documented parameter, so a dated search
  // bounds the request to the requested travel date in UTC, clamped to the
  // provider's look-ahead limit (e.g. an end-of-window at 23:59 two days out
  // would exceed it and make the provider reject the request).
  const params = new URLSearchParams();
  if (travelDate) {
    params.set("start", clampedStart(travelDate));
    params.set("end", clampedEnd(travelDate));
  }
  params.set("max_pages", "2");
  const url = `${AEROAPI_BASE}/flights/${encodeURIComponent(ident)}?${params.toString()}`;
  const { response } = await callAeroApi(url);
  if ("error" in response) return response;

  const payload = await parseJsonResponse(response);
  if ("error" in payload) return payload.error;

  const rawFlights = Array.isArray(payload.data.flights) ? payload.data.flights : [];
  const mapped = rawFlights
    .map((f) => mapAeroFlight(f as Record<string, unknown>))
    .filter((f): f is NonNullable<ReturnType<typeof mapAeroFlight>> => f !== null)
    .filter((f) => !travelDate || f.scheduledDeparture?.slice(0, 10) === travelDate || f.date === travelDate);

  // A genuine no-match is a normal empty result: 200 with an empty flights
  // array and no error field. Upstream failures keep their distinct error kinds.
  return json({ flights: mapped, source: "FlightAware AeroAPI", fetchedAt: new Date().toISOString() });
}

async function handleAirportBoard(airport: string, direction: "departures" | "arrivals", travelDate: string | null): Promise<Response> {
  if (!/^[A-Z]{3,4}$/.test(airport)) {
    return json({ error: "invalid_request", message: "airport must be a 3-4 letter IATA or ICAO code, e.g. NBO." }, 400);
  }

  const params = new URLSearchParams();
  if (travelDate) {
    params.set("start", clampedStart(travelDate));
    params.set("end", clampedEnd(travelDate));
  }
  params.set("max_pages", "1");
  const url = `${AEROAPI_BASE}/airports/${encodeURIComponent(airport)}/${direction}?${params.toString()}`;
  const { response } = await callAeroApi(url);
  if ("error" in response) return response;

  const payload = await parseJsonResponse(response);
  if ("error" in payload) return payload.error;

  const rows = Array.isArray(payload.data[direction]) ? payload.data[direction] : [];
  const flights = rows
    .map((f) => mapAeroFlight(f as Record<string, unknown>))
    .filter((f): f is NonNullable<ReturnType<typeof mapAeroFlight>> => f !== null);

  return json({
    airport,
    direction,
    flights,
    source: "FlightAware AeroAPI",
    fetchedAt: new Date().toISOString(),
    note: flights.length ? undefined : "The provider returned no matching flights for this airport and window.",
  });
}

async function parseJsonResponse(response: Response): Promise<{ data: Record<string, unknown> } | { error: Response }> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return { error: json({ error: "unavailable", message: "The provider response could not be parsed." }, 502) };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: json({ error: "unavailable", message: "The provider returned an unexpected response shape." }, 502) };
  }
  return { data: parsed as Record<string, unknown> };
}

async function callAeroApi(url: string): Promise<{ response: Response | { error: Response } }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetch(url, {
      headers: { "x-apikey": AEROAPI_KEY! },
      signal: controller.signal,
    });
    if (upstream.status === 401 || upstream.status === 403) {
      return { response: { error: json({ error: "auth", message: "The provider rejected the configured credentials." }, 502) } };
    }
    if (upstream.status === 429) {
      return { response: { error: json({ error: "rate_limit", message: "Provider rate limit reached. Try again shortly." }, 429) } };
    }
    if (!upstream.ok) {
      console.error(`aeroapi upstream status ${upstream.status} for ${new URL(url).pathname}${new URL(url).search}`);
      return { response: { error: json({ error: "unavailable", message: `Provider responded with status ${upstream.status}.` }, 502) } };
    }
    return { response: upstream };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "AbortError";
    if (!timedOut) console.error(`aeroapi request failed: ${err instanceof Error ? err.message : "unknown error"}`);
    return { response: { error: json({ error: timedOut ? "timeout" : "unavailable", message: timedOut ? "The provider took too long to respond." : "The provider could not be reached." }, 504) } };
  } finally {
    clearTimeout(timeout);
  }
}

function mapAeroFlight(f: Record<string, unknown>) {
  const ident = typeof f.ident === "string" ? f.ident : typeof f.ident_iata === "string" ? f.ident_iata : null;
  const origin = f.origin as Record<string, unknown> | undefined;
  const destination = f.destination as Record<string, unknown> | undefined;
  if (!ident || !origin || !destination) return null;

  const operator = f.operator as string | undefined;
  const operatorIata = f.operator_iata as string | undefined;
  const airlineCode = operatorIata ?? operator?.slice(0, 3) ?? ident.replace(/\d+$/, "");
  const statusRaw = typeof f.status === "string" ? f.status : "";
  const cancelled = f.cancelled === true || statusRaw.toLowerCase().includes("cancelled");
  const diverted = f.diverted === true || statusRaw.toLowerCase().includes("diverted");
  const date =
    (typeof f.day === "string" && f.day) ||
    (typeof f.scheduled_off === "string" && f.scheduled_off.slice(0, 10)) ||
    (typeof f.scheduled_departure === "string" && f.scheduled_departure.slice(0, 10)) ||
    "";

  return {
    id: (typeof f.fa_flight_id === "string" ? f.fa_flight_id : `${ident}-${date}`),
    flightNumber: formatFlightNumber(ident),
    airline: operatorIata ? `${operatorIata} ${String(f.flight_number ?? "").trim()}`.trim() : operator ?? airlineCode,
    airlineCode,
    origin: {
      code: (origin.code_iata ?? origin.code) as string,
      city: (origin.city ?? origin.code_iata ?? origin.code) as string,
      timezone: origin.timezone as string | undefined,
      scheduledTime: (f.scheduled_off ?? f.scheduled_departure) as string | undefined,
      estimatedTime: (f.estimated_off ?? f.estimated_departure) as string | undefined,
      actualTime: (f.actual_off ?? f.actual_departure) as string | undefined,
    },
    destination: {
      code: (destination.code_iata ?? destination.code) as string,
      city: (destination.city ?? destination.code_iata ?? destination.code) as string,
      timezone: destination.timezone as string | undefined,
      scheduledTime: (f.scheduled_in ?? f.scheduled_arrival) as string | undefined,
      estimatedTime: (f.estimated_in ?? f.estimated_arrival) as string | undefined,
      actualTime: (f.actual_in ?? f.actual_arrival) as string | undefined,
    },
    date,
    status: statusRaw,
    cancelled,
    diverted,
    duration: formatDuration(f.block_time ?? f.filed_ete),
    terminal: (origin.terminal ?? origin.terminal_gate) as string | undefined,
    gate: (origin.gate ?? origin.gate_origin) as string | undefined,
    aircraft: typeof f.aircraft_type === "string" ? f.aircraft_type : undefined,
    aircraftRegistration: typeof f.registration === "string" ? f.registration : undefined,
    scheduledDeparture: (f.scheduled_off ?? f.scheduled_departure) as string | undefined,
    scheduledArrival: (f.scheduled_in ?? f.scheduled_arrival) as string | undefined,
    estimatedDeparture: (f.estimated_off ?? f.estimated_departure) as string | undefined,
    estimatedArrival: (f.estimated_in ?? f.estimated_arrival) as string | undefined,
    actualDeparture: (f.actual_off ?? f.actual_departure) as string | undefined,
    actualArrival: (f.actual_in ?? f.actual_arrival) as string | undefined,
    departureDelayMinutes: toDelayMinutes(f.departure_delay),
    arrivalDelayMinutes: toDelayMinutes(f.arrival_delay),
    lastUpdatedAt: (f.last_position?._ts ?? f.updated ?? new Date().toISOString()) as string,
  };
}

// AeroAPI reports departure_delay/arrival_delay in seconds (may be null).
function toDelayMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value / 60);
}

function formatFlightNumber(ident: string): string {
  const match = ident.match(/^([A-Z]{2,3})(\d+[A-Z]?)$/);
  return match ? `${match[1]} ${match[2]}` : ident;
}

// AeroAPI reports block_time/filed_ete in seconds.
function formatDuration(seconds: unknown): string | undefined {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function sanitizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

const DAY_MS = 86_400_000;

// AeroAPI rejects an `end` more than 2 days in the future; clamp so a
// requested travel date at the boundary still returns the flights inside
// the allowed window.
function clampedEnd(travelDate: string): string {
  const requested = new Date(`${travelDate}T23:59:59Z`).getTime();
  const maxFuture = Date.now() + 2 * DAY_MS;
  return new Date(Math.min(requested, maxFuture)).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// AeroAPI rejects a `start` more than 10 days in the past.
function clampedStart(travelDate: string): string {
  const requested = new Date(`${travelDate}T00:00:00Z`).getTime();
  const minPast = Date.now() - 10 * DAY_MS;
  return new Date(Math.max(requested, minPast)).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
