import {
  admin, CLIENT_ID, CLIENT_SECRET, WEBHOOK_ID, ENVIRONMENT, PAYPAL_API, fulfilCommerceOrder, json,
} from "../_shared/commerce.ts";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function accessToken(): Promise<string> {
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new Error("PayPal authentication failed.");
  }
  return payload.access_token;
}

async function verifySignature(req: Request, event: Record<string, unknown>): Promise<boolean> {
  const signature = {
    auth_algo: req.headers.get("paypal-auth-algo"),
    cert_url: req.headers.get("paypal-cert-url"),
    transmission_id: req.headers.get("paypal-transmission-id"),
    transmission_sig: req.headers.get("paypal-transmission-sig"),
    transmission_time: req.headers.get("paypal-transmission-time"),
    webhook_id: WEBHOOK_ID,
    webhook_event: event,
  };
  if (Object.values(signature).some((value) => !value)) return false;
  const token = await accessToken();
  const response = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(signature),
    signal: AbortSignal.timeout(12000),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  return response.ok && result.verification_status === "SUCCESS";
}

async function claimEvent(eventId: string, eventType: string, event: Record<string, unknown>) {
  if (!admin) throw new Error("Commerce database is not configured.");
  const { data, error } = await admin.rpc("songa_claim_commerce_webhook_event", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload: event,
  });
  if (error) throw error;
  const claim = Array.isArray(data) ? data[0] : data;
  return {
    claimed: claim?.claimed === true,
    processed: claim?.processed === true,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!admin || !CLIENT_ID || !CLIENT_SECRET || !WEBHOOK_ID) return json({ error: "not_configured" }, 503);

  let event: Record<string, unknown>;
  try {
    event = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const eventId = typeof event.id === "string" ? event.id : "";
  const eventType = typeof event.event_type === "string" ? event.event_type : "UNKNOWN";
  if (!eventId) return json({ error: "missing_event_id" }, 400);

  try {
    if (!await verifySignature(req, event)) return json({ error: "invalid_signature" }, 400);

    // The database RPC grants one worker a short processing lease. Concurrent
    // deliveries cannot both fulfil the same event; failed attempts release it.
    const claim = await claimEvent(eventId, eventType, event);
    if (claim.processed) return json({ received: true, duplicate: true });
    if (!claim.claimed) return json({ error: "event_processing_in_progress" }, 503);

    const resource = asRecord(event.resource);
    const supplementaryData = asRecord(resource.supplementary_data);
    const relatedIds = asRecord(supplementaryData.related_ids);
    const relatedOrderId = relatedIds.order_id;

    const captureEvents = [
      "PAYMENT.CAPTURE.COMPLETED",
      "PAYMENT.CAPTURE.DENIED",
      "PAYMENT.CAPTURE.PENDING",
      "PAYMENT.CAPTURE.REFUNDED",
      "PAYMENT.CAPTURE.REVERSED",
    ];
    if (captureEvents.includes(eventType)) {
      if (typeof relatedOrderId !== "string" || !relatedOrderId) {
        throw new Error(`PayPal ${eventType} event has no related order ID.`);
      }
      const { data: order, error: orderError } = await admin
        .from("songa_commerce_orders")
        .select("*")
        .eq("paypal_order_id", relatedOrderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) throw new Error(`No Songa commerce order matches PayPal order ${relatedOrderId}.`);

      if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
        const amount = asRecord(resource.amount);
        const captureId = typeof resource.id === "string" ? resource.id : "";
        const captureMatches = amount.currency_code === order.currency_code
          && Number.isFinite(Number(amount.value))
          && Number(amount.value) === Number(order.amount);
        if (!captureId || !captureMatches) {
          throw new Error(`PayPal capture validation failed for Songa order ${order.id}.`);
        }

        const { error: updateError } = await admin.from("songa_commerce_orders").update({
          payment_status: "COMPLETED",
          paypal_capture_id: captureId,
          captured_at: new Date().toISOString(),
        }).eq("id", order.id);
        if (updateError) throw updateError;

        const { data: refreshed, error: refreshError } = await admin
          .from("songa_commerce_orders").select("*").eq("id", order.id).single();
        if (refreshError || !refreshed) throw refreshError ?? new Error("Order refresh failed.");
        await fulfilCommerceOrder(refreshed);
      } else {
        const status = eventType.endsWith("DENIED") ? "DENIED"
          : eventType.endsWith("PENDING") ? "PENDING"
          : eventType.endsWith("REFUNDED") ? "REFUNDED" : "REVERSED";

        const { error: orderUpdateError } = await admin.from("songa_commerce_orders")
          .update({ payment_status: status }).eq("id", order.id);
        if (orderUpdateError) throw orderUpdateError;

        if (status === "REFUNDED" || status === "REVERSED") {
          const { error: entitlementError } = await admin.from("songa_commerce_entitlements")
            .update({ status: "REVOKED" }).eq("source_order_id", order.id);
          if (entitlementError) throw entitlementError;

          const { error: airsideError } = await admin.from("songa_airside_orders")
            .update({ fulfilment_status: "CANCELLED", updated_at: new Date().toISOString() })
            .eq("commerce_order_id", order.id);
          if (airsideError) throw airsideError;
        }
      }
    }

    const { error: completeError } = await admin.from("songa_commerce_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString(), processing_started_at: null, last_error: null })
      .eq("event_id", eventId);
    if (completeError) throw completeError;

    return json({ received: true, environment: ENVIRONMENT });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("Songa commerce webhook processing failed", message);
    // Make the event immediately retryable. Do not acknowledge failed fulfilment.
    const { error: releaseError } = await admin.from("songa_commerce_webhook_events")
      .update({ processing_started_at: null, last_error: message.slice(0, 500) })
      .eq("event_id", eventId)
      .eq("processed", false);
    if (releaseError) console.error("Could not release failed webhook event", releaseError.code);
    return json({ error: "processing_failed" }, 500);
  }
});
