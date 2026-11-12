import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") ?? "";
const ENVIRONMENT = (Deno.env.get("PAYPAL_ENVIRONMENT") ?? "sandbox").toLowerCase();
const API = ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const APP_URL = (Deno.env.get("SONGA_APP_URL") ?? "https://songa.co.ke").replace(/\/$/, "");
const PRICE = (Deno.env.get("SONGA_PREMIUM_PRICE_USD") ?? "3.99").trim();
const PRODUCT = { id: "premium-travel-assistance", name: "Songa Premium Travel Assistance", description: "Extended AI disruption guidance, a personalised action plan and a practical traveller checklist for one flight." };
const admin = SUPABASE_URL && SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } }) : null;
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
async function accessToken(): Promise<string> {
  const response = await fetch(`${API}/v1/oauth2/token`, { method: "POST", headers: { "Authorization": `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(12_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") throw new Error("PayPal could not issue an access token.");
  return payload.access_token;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!CLIENT_ID || !CLIENT_SECRET || !admin) return json({ error: "not_configured", message: "PayPal Sandbox is not configured on the Songa server." }, 503);
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt || jwt === auth || !admin) return json({ error: "unauthenticated", message: "Sign in before purchasing Songa Premium." }, 401);
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) return json({ error: "unauthenticated", message: "Your Songa session has expired. Please sign in again." }, 401);
  let body: { productId?: string; flightNumber?: string; travelDate?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_request", message: "Invalid checkout request." }, 400); }
  const flightNumber = (body.flightNumber ?? "").toUpperCase().replace(/\s+/g, "");
  const travelDate = body.travelDate ?? "";
  if (body.productId !== PRODUCT.id || !/^[A-Z0-9]{2,10}$/.test(flightNumber) || !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) {
    return json({ error: "invalid_request", message: "A valid product, flight number and travel date are required." }, 400);
  }
  // Verify the selected flight against the connected provider before creating a paid order.
  const flightCheck = await fetch(`${SUPABASE_URL}/functions/v1/flight-search`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SERVICE_ROLE}`, "apikey": SERVICE_ROLE, "Content-Type": "application/json" },
    body: JSON.stringify({ flightNumber, travelDate }),
    signal: AbortSignal.timeout(16_000),
  }).catch(() => null);
  if (!flightCheck?.ok) return json({ error: "flight_verification_unavailable", message: "Songa could not verify this flight with its provider. No payment has been started; please try again." }, 503);
  const flightPayload = await flightCheck.json().catch(() => ({})) as Record<string, unknown>;
  const providerFlights = Array.isArray(flightPayload.flights) ? flightPayload.flights as Array<Record<string, unknown>> : [];
  const verifiedFlight = providerFlights.some((item) => {
    const providerNumber = typeof item.flightNumber === "string" ? item.flightNumber.toUpperCase().replace(/\s+/g, "") : "";
    const providerDate = typeof item.date === "string" ? item.date : typeof item.scheduledDeparture === "string" ? item.scheduledDeparture.slice(0, 10) : "";
    return providerNumber === flightNumber && providerDate === travelDate;
  });
  if (!verifiedFlight) return json({ error: "flight_not_verified", message: "No matching provider-backed flight was found for that number and date. Please search again before purchasing." }, 409);

  const numericPrice = Number(PRICE);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > 100) return json({ error: "configuration_error", message: "The Songa Premium price is not configured correctly." }, 500);
  try {
    const token = await accessToken();
    const requestId = crypto.randomUUID();
    const response = await fetch(`${API}/v2/checkout/orders`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": requestId },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: PRODUCT.id, description: PRODUCT.description, custom_id: `${userData.user.id}|${flightNumber}|${travelDate}`, amount: { currency_code: "USD", value: numericPrice.toFixed(2) } }],
        application_context: { brand_name: "Songa AI", user_action: "PAY_NOW", return_url: `${APP_URL}/?paypal=success`, cancel_url: `${APP_URL}/?paypal=cancel`, shipping_preference: "NO_SHIPPING" },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const order = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof order.id !== "string") {
      console.error("PayPal create order failed", response.status, order.name ?? order.message ?? "unknown");
      return json({ error: "paypal_create_failed", message: "PayPal could not start checkout. Please try again." }, 502);
    }
    const links = Array.isArray(order.links) ? order.links as Array<Record<string, unknown>> : [];
    const approvalUrl = links.find((link) => ["approve", "payer-action"].includes(String(link.rel)))?.href;
    if (typeof approvalUrl !== "string") return json({ error: "paypal_link_missing", message: "PayPal did not return an approval link." }, 502);
    const { error: insertError } = await admin.from("paypal_orders").insert({ paypal_order_id: order.id, user_id: userData.user.id, product_id: PRODUCT.id, flight_number: flightNumber, travel_date: travelDate, currency: "USD", amount: numericPrice.toFixed(2), status: "CREATED", environment: ENVIRONMENT });
    if (insertError) {
      console.error("Unable to persist PayPal order", insertError.code);
      return json({ error: "order_persist_failed", message: "Songa could not save this checkout. No payment has been captured; please try again." }, 500);
    }
    return json({ orderId: order.id, approvalUrl, amount: numericPrice.toFixed(2), currency: "USD", environment: ENVIRONMENT });
  } catch (error) {
    console.error("PayPal create order error", error instanceof Error ? error.message : "unknown");
    return json({ error: "paypal_unavailable", message: "PayPal checkout is temporarily unavailable." }, 502);
  }
});
