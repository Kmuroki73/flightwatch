import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") ?? "";
const ENVIRONMENT = (Deno.env.get("PAYPAL_ENVIRONMENT") ?? "sandbox").toLowerCase();
const API = ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const admin = SUPABASE_URL && SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } }) : null;
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
async function accessToken(): Promise<string> {
  const r = await fetch(`${API}/v1/oauth2/token`, { method: "POST", headers: { "Authorization": `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(12_000) });
  const d = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok || typeof d.access_token !== "string") throw new Error("PayPal access token unavailable.");
  return d.access_token;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!admin || !CLIENT_ID || !CLIENT_SECRET) return json({ error: "not_configured", message: "PayPal capture is not configured." }, 503);
  const authorization = req.headers.get("Authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (!jwt || jwt === authorization) return json({ error: "unauthenticated", message: "Sign in to verify this purchase." }, 401);
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) return json({ error: "unauthenticated", message: "Your Songa session has expired." }, 401);
  let orderId = "";
  try { const body = await req.json(); orderId = typeof body?.orderId === "string" ? body.orderId : ""; } catch { /* handled below */ }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(orderId)) return json({ error: "invalid_request", message: "A valid PayPal order ID is required." }, 400);
  const { data: stored, error: lookupError } = await admin.from("paypal_orders").select("*").eq("paypal_order_id", orderId).eq("user_id", userData.user.id).maybeSingle();
  if (lookupError || !stored) return json({ error: "order_not_found", message: "This order does not belong to the signed-in Songa account." }, 404);
  if (stored.status === "COMPLETED") return json({ completed: true, message: "Payment already verified." });
  try {
    const token = await accessToken();
    const response = await fetch(`${API}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `capture-${orderId}` }, body: "{}", signal: AbortSignal.timeout(20_000) });
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      if (response.status === 422 && stored.status === "COMPLETED") return json({ completed: true, message: "Payment already verified." });
      console.error("PayPal capture failed", response.status, result.name ?? "unknown");
      return json({ completed: false, message: "PayPal has not confirmed a completed payment yet. Please refresh or contact Songa support." }, 502);
    }
    const units = Array.isArray(result.purchase_units) ? result.purchase_units as Array<Record<string, unknown>> : [];
    const payments = units[0]?.payments && typeof units[0].payments === "object" ? units[0].payments as Record<string, unknown> : {};
    const captures = Array.isArray(payments.captures) ? payments.captures as Array<Record<string, unknown>> : [];
    const capture = captures[0] ?? {};
    const amount = capture.amount && typeof capture.amount === "object" ? capture.amount as Record<string, unknown> : {};
    const amountMatches = amount.currency_code === stored.currency && Number(amount.value) === Number(stored.amount);
    if (result.status !== "COMPLETED" || capture.status !== "COMPLETED" || !amountMatches || typeof capture.id !== "string") {
      await admin.from("paypal_orders").update({ status: String(result.status ?? "PENDING"), paypal_capture_id: typeof capture.id === "string" ? capture.id : null }).eq("paypal_order_id", orderId).eq("user_id", userData.user.id);
      return json({ completed: false, message: "The payment is not yet confirmed for the expected amount." }, 409);
    }
    const { error: updateError } = await admin.from("paypal_orders").update({ status: "COMPLETED", paypal_capture_id: capture.id, captured_at: new Date().toISOString() }).eq("paypal_order_id", orderId).eq("user_id", userData.user.id);
    if (updateError) throw updateError;
    const { error: entitlementError } = await admin.from("premium_entitlements").upsert({ user_id: userData.user.id, product_id: stored.product_id, flight_number: stored.flight_number, travel_date: stored.travel_date, paypal_order_id: orderId, status: "active" }, { onConflict: "paypal_order_id" });
    if (entitlementError) throw entitlementError;
    return json({ completed: true, message: "Payment verified. Your Songa Premium assistance is active." });
  } catch (error) {
    console.error("PayPal capture error", error instanceof Error ? error.message : "unknown");
    return json({ completed: false, message: "Payment verification is temporarily unavailable. Do not pay again until the order status has been checked." }, 502);
  }
});
