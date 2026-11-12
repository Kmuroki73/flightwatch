import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADAPTER_URL = Deno.env.get("ACCOMMODATION_ADAPTER_URL") ?? "";
const ADAPTER_TOKEN = Deno.env.get("ACCOMMODATION_ADAPTER_TOKEN") ?? "";
const admin = SUPABASE_URL && SERVICE_ROLE
  ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  : null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!admin) return json({ error: "not_configured", message: "Accommodation search is not configured on Songa." }, 503);

  const authorization = req.headers.get("Authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (!jwt || jwt === authorization) return json({ error: "unauthenticated", message: "Sign in to search accommodation." }, 401);
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) return json({ error: "unauthenticated", message: "Your Songa session has expired. Please sign in again." }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_request", message: "Send a valid accommodation search." }, 400); }
  const city = typeof body.city === "string" ? body.city.trim().slice(0, 100) : "";
  const checkIn = body.checkIn;
  const checkOut = body.checkOut;
  const guests = Number(body.guests);
  if (!city || !validDate(checkIn) || !validDate(checkOut)
    || checkIn < new Date().toISOString().slice(0, 10)
    || checkOut <= checkIn || !Number.isInteger(guests) || guests < 1 || guests > 8) {
    return json({ error: "invalid_search", message: "Enter a destination, valid future dates and between one and eight guests." }, 400);
  }

  if (!ADAPTER_URL || !ADAPTER_TOKEN) {
    return json({
      error: "provider_not_configured",
      message: "Accommodation partner connection is not active yet. Songa will not show invented hotel listings or accept payment until a provider confirms availability.",
      offers: [],
    }, 503);
  }

  let endpoint: URL;
  try {
    endpoint = new URL(ADAPTER_URL);
    if (endpoint.protocol !== "https:") throw new Error("HTTPS is required.");
  } catch {
    return json({ error: "provider_configuration_error", message: "The accommodation provider endpoint must be a valid HTTPS URL." }, 503);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${ADAPTER_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "search", city, checkIn, checkOut, guests, currency: "USD" }),
      signal: AbortSignal.timeout(18000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      console.error("Accommodation provider search failed", response.status);
      return json({ error: "provider_unavailable", message: "The accommodation partner could not complete this search. Please try again later." }, 502);
    }
    const rawOffers = Array.isArray(payload.offers) ? payload.offers : [];
    const offers = rawOffers.flatMap((raw: unknown) => {
      if (!raw || typeof raw !== "object") return [];
      const offer = raw as Record<string, unknown>;
      const price = Number(offer.price);
      const currency = typeof offer.currency === "string" ? offer.currency.toUpperCase() : "";
      if (typeof offer.id !== "string" || typeof offer.name !== "string"
        || typeof offer.location !== "string" || !Number.isFinite(price) || price <= 0
        || !/^[A-Z]{3}$/.test(currency)) return [];
      const imageUrl = typeof offer.imageUrl === "string" && offer.imageUrl.startsWith("https://") ? offer.imageUrl : undefined;
      return [{
        id: offer.id.slice(0, 180),
        name: offer.name.slice(0, 140),
        location: offer.location.slice(0, 180),
        description: typeof offer.description === "string" ? offer.description.slice(0, 400) : undefined,
        imageUrl,
        price,
        currency,
        priceUnit: typeof offer.priceUnit === "string" ? offer.priceUnit.slice(0, 40) : "per stay",
        providerName: typeof payload.providerName === "string" ? payload.providerName.slice(0, 80) : "Accommodation partner",
      }];
    });
    return json({ offers, provider: typeof payload.providerName === "string" ? payload.providerName : "Accommodation partner" });
  } catch (error) {
    console.error("Accommodation provider request failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "provider_timeout", message: "Accommodation search is temporarily unavailable." }, 504);
  }
});
