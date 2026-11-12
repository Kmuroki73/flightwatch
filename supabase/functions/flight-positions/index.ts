import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const AEROAPI_KEY = Deno.env.get("AEROAPI_API_KEY") ?? Deno.env.get("AEROAPI_KEY") ?? "";
const ENABLE_GLOBAL_MAP = (Deno.env.get("SONGA_ENABLE_GLOBAL_MAP") ?? "false").toLowerCase() === "true";
const BASE = "https://aeroapi.flightaware.com/aeroapi";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = SUPABASE_URL && SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } }) : null;
function json(body: unknown, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": cache } });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!ENABLE_GLOBAL_MAP) return json({ error: "disabled", message: "The global live map is not enabled for this Songa deployment. Flight search remains available." }, 503);
  if (!AEROAPI_KEY) return json({ error: "not_configured", message: "Global flight positions are not enabled for this Songa connection." }, 503);
  if (!admin) return json({ error: "not_configured", message: "The shared flight-position cache is not configured." }, 503);
  const { data: cached } = await admin.from("songa_global_positions_cache").select("payload, fetched_at").eq("id", 1).maybeSingle();
  if (cached?.payload && cached.fetched_at && Date.now() - new Date(cached.fetched_at).getTime() < 5 * 60_000) {
    return json({ ...(cached.payload as Record<string, unknown>), cached: true }, 200, "public, max-age=60, s-maxage=300, stale-while-revalidate=60");
  }
  const url = new URL(`${BASE}/flights/search/positions`);
  url.searchParams.set("query", "-inAir 1");
  url.searchParams.set("max_pages", "1");
  try {
    const upstream = await fetch(url, { headers: { "x-apikey": AEROAPI_KEY }, signal: AbortSignal.timeout(15_000) });
    if (upstream.status === 401 || upstream.status === 403) return json({ error: "provider_auth", message: "The flight provider plan or credentials do not permit this positions request." }, 502);
    if (upstream.status === 429) return json({ error: "rate_limited", message: "Live position requests are temporarily rate limited." }, 429);
    if (!upstream.ok) {
      console.error("AeroAPI position search failed", upstream.status);
      return json({ error: "provider_unavailable", message: `The flight provider returned ${upstream.status}.` }, 502);
    }
    const data = await upstream.json() as Record<string, unknown>;
    const flights = Array.isArray(data.positions) ? data.positions : Array.isArray(data.flights) ? data.flights : [];
    const positions = flights.flatMap((row: unknown) => {
      if (!row || typeof row !== "object") return [];
      const f = row as Record<string, unknown>;
      const last = f.last_position && typeof f.last_position === "object" ? f.last_position as Record<string, unknown> : {};
      const latitude = numberOrNull(last.latitude ?? f.latitude);
      const longitude = numberOrNull(last.longitude ?? f.longitude);
      if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
      const origin = f.origin && typeof f.origin === "object" ? f.origin as Record<string, unknown> : {};
      const destination = f.destination && typeof f.destination === "object" ? f.destination as Record<string, unknown> : {};
      return [{
        id: String(f.fa_flight_id ?? f.ident ?? `${latitude}:${longitude}`),
        ident: String(f.ident_iata ?? f.ident ?? "Flight"),
        origin: String(origin.code_iata ?? origin.code ?? "—"),
        destination: String(destination.code_iata ?? destination.code ?? "—"),
        latitude, longitude,
        altitudeFt: numberOrUndefined(last.altitude ?? f.altitude),
        groundspeedKts: numberOrUndefined(last.groundspeed ?? f.groundspeed),
        headingDeg: numberOrUndefined(last.heading ?? f.heading),
        updatedAt: String(last.timestamp ?? last._ts ?? f.updated ?? new Date().toISOString()),
      }];
    }).slice(0, 15);
    const payload = { positions, source: "FlightAware AeroAPI", fetchedAt: new Date().toISOString(), note: positions.length ? undefined : "The provider returned no mappable airborne positions." };
    const { error: cacheError } = await admin.from("songa_global_positions_cache").upsert({ id: 1, payload, fetched_at: payload.fetchedAt }, { onConflict: "id" });
    if (cacheError) console.error("Could not persist global position cache", cacheError.code);
    return json(payload, 200, "public, max-age=60, s-maxage=300, stale-while-revalidate=60");
  } catch (error) {
    console.error("AeroAPI position request failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "provider_timeout", message: "Live aircraft positions are temporarily unavailable." }, 504);
  }
});
function numberOrNull(value: unknown): number | null { const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN; return Number.isFinite(n) ? n : null; }
function numberOrUndefined(value: unknown): number | undefined { const n = numberOrNull(value); return n === null ? undefined : n; }
