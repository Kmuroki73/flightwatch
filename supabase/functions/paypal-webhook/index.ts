import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, PayPal-Transmission-Id, PayPal-Transmission-Time, PayPal-Transmission-Sig, PayPal-Cert-Url, PayPal-Auth-Algo" };
const CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") ?? "";
const WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID") ?? "";
const ENVIRONMENT = (Deno.env.get("PAYPAL_ENVIRONMENT") ?? "sandbox").toLowerCase();
const API = ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
async function token(): Promise<string> {
  const response = await fetch(`${API}/v1/oauth2/token`, { method: "POST", headers: { "Authorization": `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof data.access_token !== "string") throw new Error("PayPal authentication failed.");
  return data.access_token;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!CLIENT_ID || !CLIENT_SECRET || !WEBHOOK_ID) return json({ error: "not_configured" }, 503);
  let event: Record<string, unknown>;
  try { event = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const headers = {
    auth_algo: req.headers.get("paypal-auth-algo"),
    cert_url: req.headers.get("paypal-cert-url"),
    transmission_id: req.headers.get("paypal-transmission-id"),
    transmission_sig: req.headers.get("paypal-transmission-sig"),
    transmission_time: req.headers.get("paypal-transmission-time"),
    webhook_id: WEBHOOK_ID,
    webhook_event: event,
  };
  if (Object.values(headers).some((value) => value === null || value === "")) return json({ error: "missing_signature_headers" }, 400);
  try {
    const access = await token();
    const verifyResponse = await fetch(`${API}/v1/notifications/verify-webhook-signature`, { method: "POST", headers: { "Authorization": `Bearer ${access}`, "Content-Type": "application/json" }, body: JSON.stringify(headers) });
    const verification = await verifyResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!verifyResponse.ok || verification.verification_status !== "SUCCESS") return json({ error: "invalid_signature" }, 400);

    const eventId = typeof event.id === "string" ? event.id : "";
    const eventType = typeof event.event_type === "string" ? event.event_type : "UNKNOWN";
    if (!eventId) return json({ error: "missing_event_id" }, 400);
    const { error: eventError } = await admin.from("paypal_webhook_events").insert({ event_id: eventId, event_type: eventType, payload: event, processed: false });
    if (eventError?.code === "23505") return json({ received: true, duplicate: true });
    if (eventError) throw eventError;

    const resource = event.resource && typeof event.resource === "object" ? event.resource as Record<string, unknown> : {};
    const supplementary = resource.supplementary_data && typeof resource.supplementary_data === "object" ? resource.supplementary_data as Record<string, unknown> : {};
    const related = supplementary.related_ids && typeof supplementary.related_ids === "object" ? supplementary.related_ids as Record<string, unknown> : {};
    const orderId = typeof related.order_id === "string" ? related.order_id : typeof resource.invoice_id === "string" ? resource.invoice_id : null;
    const captureId = typeof resource.id === "string" ? resource.id : null;
    if (orderId) {
      const { data: order, error: orderError } = await admin.from("paypal_orders").select("*").eq("paypal_order_id", orderId).maybeSingle();
      if (orderError) throw orderError;
      if (order) {
        if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
          const amount = resource.amount && typeof resource.amount === "object" ? resource.amount as Record<string, unknown> : {};
          const validAmount = amount.currency_code === order.currency && Number(amount.value) === Number(order.amount);
          if (validAmount) {
            await admin.from("paypal_orders").update({ status: "COMPLETED", paypal_capture_id: captureId, captured_at: new Date().toISOString() }).eq("paypal_order_id", orderId);
            await admin.from("premium_entitlements").upsert({ user_id: order.user_id, product_id: order.product_id, flight_number: order.flight_number, travel_date: order.travel_date, paypal_order_id: orderId, status: "active" }, { onConflict: "paypal_order_id" });
          }
        } else if (["PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.PENDING", "PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"].includes(eventType)) {
          const status = eventType.endsWith("DENIED") ? "DENIED" : eventType.endsWith("PENDING") ? "PENDING" : eventType.endsWith("REFUNDED") ? "REFUNDED" : "REVERSED";
          await admin.from("paypal_orders").update({ status, paypal_capture_id: captureId }).eq("paypal_order_id", orderId);
          if (status === "REFUNDED" || status === "REVERSED") await admin.from("premium_entitlements").update({ status: "revoked" }).eq("paypal_order_id", orderId);
        }
      }
    }
    await admin.from("paypal_webhook_events").update({ processed: true, processed_at: new Date().toISOString() }).eq("event_id", eventId);
    return json({ received: true });
  } catch (error) {
    console.error("PayPal webhook processing failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "processing_failed" }, 500);
  }
});
