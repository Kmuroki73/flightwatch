import { corsHeaders } from "../_shared/commerce.ts";

const API_KEY = Deno.env.get("WEATHERAPI_KEY") ?? "";
const API_BASE = "https://api.weatherapi.com/v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; payload: unknown }>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!API_KEY) return json({ error: "weather_not_configured", message: "Weather is not configured yet." }, 503);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const lat = Number(body.latitude);
  const lon = Number(body.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  if (!query && !hasCoords) return json({ error: "invalid_location", message: "Provide a city, airport or valid coordinates." }, 400);
  if (query.length > 120) return json({ error: "invalid_location" }, 400);

  const location = hasCoords ? `${lat.toFixed(3)},${lon.toFixed(3)}` : query;
  const cacheKey = location.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json({ ...cached.payload as object, cached: true });

  const url = new URL(`${API_BASE}/forecast.json`);
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("q", location);
  url.searchParams.set("days", "3");
  url.searchParams.set("aqi", "no");
  url.searchParams.set("alerts", "no");

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return json({ error: "weather_provider_error", message: "Weather data is temporarily unavailable." }, response.status === 400 ? 400 : 502);
    const result = { source: "WeatherAPI.com", fetchedAt: new Date().toISOString(), location: payload.location, current: payload.current, forecast: payload.forecast, cached: false };
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload: result });
    if (cache.size > 300) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return json(result);
  } catch {
    return json({ error: "weather_unavailable", message: "Weather data is temporarily unavailable." }, 502);
  }
});
