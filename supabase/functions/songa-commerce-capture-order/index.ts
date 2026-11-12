import { admin, authenticatedUser, fulfilCommerceOrder, json, paypalAccessToken, PAYPAL_API } from "../_shared/commerce.ts";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!admin) return json({ error: "not_configured", message: "Songa Commerce is not configured." }, 503);
  const { user, error: authError } = await authenticatedUser(req);
  if (!user) return json({ error: "unauthenticated", message: authError ?? "Sign in to verify your purchase." }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(orderId)) return json({ error: "invalid_order", message: "A valid PayPal order ID is required." }, 400);
  const { data: stored, error: lookupError } = await admin.from("songa_commerce_orders").select("*").eq("paypal_order_id", orderId).eq("user_id", user.id).maybeSingle();
  if (lookupError || !stored) return json({ error: "order_not_found", message: "This order does not belong to the signed-in Songa account." }, 404);
  try {
    if (stored.payment_status !== "COMPLETED") {
      const accessToken = await paypalAccessToken();
      const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json", "PayPal-Request-Id": `songa-capture-${stored.id}` },
        body: "{}",
        signal: AbortSignal.timeout(20000),
      });
      const resultValue: unknown = await response.json().catch(() => ({}));
      const result = asRecord(resultValue);
      if (!response.ok) {
        if (!(response.status === 422 && stored.payment_status === "COMPLETED")) {
          console.error("Songa commerce capture failed", response.status, result.name ?? "unknown");
          return json({ completed: false, message: "PayPal has not confirmed this payment. Do not pay again until the order is checked." }, 502);
        }
      }
      const units = Array.isArray(result.purchase_units) ? result.purchase_units.map(asRecord) : [];
      const payments = asRecord(units[0]?.payments);
      const captures = Array.isArray(payments.captures) ? payments.captures.map(asRecord) : [];
      const capture = captures[0] ?? {};
      const capturedAmount = asRecord(capture.amount);
      const amountMatches = capturedAmount.currency_code === stored.currency_code && Number(capturedAmount.value) === Number(stored.amount);
      if (result.status !== "COMPLETED" || capture.status !== "COMPLETED" || !amountMatches || typeof capture.id !== "string") {
        await admin.from("songa_commerce_orders").update({ payment_status: String(result.status ?? "PENDING") }).eq("id", stored.id);
        return json({ completed: false, message: "The payment is not yet confirmed for the expected amount." }, 409);
      }
      const { error: updateError } = await admin.from("songa_commerce_orders").update({ payment_status: "COMPLETED", paypal_capture_id: capture.id, captured_at: new Date().toISOString() }).eq("id", stored.id).eq("user_id", user.id);
      if (updateError) throw updateError;
    }
    const { data: refreshed, error: refreshError } = await admin.from("songa_commerce_orders").select("*").eq("id", stored.id).single();
    if (refreshError || !refreshed) throw refreshError ?? new Error("Order not found after capture.");
    const fulfilment = await fulfilCommerceOrder(refreshed);
    return json({ completed: true, productId: refreshed.product_id, productName: refreshed.product_name, amount: refreshed.amount, currency: refreshed.currency_code, fulfilmentStatus: refreshed.fulfilment_status, ...fulfilment, message: "PayPal payment verified and the Songa service has been issued." });
  } catch (error) {
    console.error("Songa commerce capture error", error instanceof Error ? error.message : "unknown");
    return json({ completed: false, message: "Payment verification or service activation is temporarily unavailable. Do not pay again until your order status has been checked." }, 502);
  }
});
