import { AIRSIDE_MENU, APP_URL, PRODUCT_CATALOG, admin, authenticatedUser, json, paypalAccessToken, PAYPAL_API, type ProductId } from "../_shared/commerce.ts";

function validDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()); }
function validEmail(value: string): boolean { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

async function verifyFlight(flightNumber: string, travelDate: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRole) return false;
  const response = await fetch(`${supabaseUrl}/functions/v1/flight-search`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${serviceRole}`, "apikey": serviceRole, "Content-Type": "application/json" },
    body: JSON.stringify({ flightNumber, travelDate }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!response?.ok) return false;
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const flights = Array.isArray(payload.flights) ? payload.flights as Array<Record<string, unknown>> : [];
  return flights.some((flight) => {
    const number = typeof flight.flightNumber === "string" ? flight.flightNumber.toUpperCase().replace(/\s+/g, "") : "";
    const date = typeof flight.date === "string" ? flight.date : typeof flight.scheduledDeparture === "string" ? flight.scheduledDeparture.slice(0, 10) : "";
    return number === flightNumber && date === travelDate;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!admin) return json({ error: "not_configured", message: "Songa Commerce is not configured." }, 503);
  const { user, error: authError } = await authenticatedUser(req);
  if (!user) return json({ error: "unauthenticated", message: authError ?? "Sign in to continue." }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json", message: "Invalid checkout request." }, 400); }
  const productId = typeof body.productId === "string" ? body.productId as ProductId : null;
  if (!productId || !["songa-premium-30", "songa-premium-365", "songa-trip-rescue", "songa-family-watch", "songa-gift-watch", "songa-airside-order"].includes(productId)) {
    return json({ error: "invalid_product", message: "Choose a valid Songa service." }, 400);
  }

  let productName = "";
  let amount = 0;
  let description = "";
  let context: Record<string, unknown> = {};
  let paypalItems: Array<Record<string, unknown>> = [];

  if (productId === "songa-airside-order") {
    const airportCode = typeof body.airportCode === "string" ? body.airportCode.toUpperCase() : "NBO";
    if (airportCode !== "NBO") return json({ error: "airport_unavailable", message: "The Songa Airside Sandbox pilot currently supports NBO (JKIA) only." }, 400);
    const cart = Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [];
    if (!cart.length || cart.length > 12) return json({ error: "empty_cart", message: "Add at least one Airside item to your order." }, 400);
    const normalized: Array<{ sku: string; name: string; quantity: number; unitPrice: number }> = [];
    for (const line of cart) {
      const sku = typeof line.sku === "string" ? line.sku as keyof typeof AIRSIDE_MENU : null;
      const quantity = Number(line.quantity);
      if (!sku || !(sku in AIRSIDE_MENU) || !Number.isInteger(quantity) || quantity < 1 || quantity > 8) return json({ error: "invalid_cart", message: "One of the selected Airside items is invalid." }, 400);
      const item = AIRSIDE_MENU[sku];
      normalized.push({ sku, name: item.name, quantity, unitPrice: item.price });
    }
    amount = normalized.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    productName = "Songa Airside · JKIA Sandbox Order";
    description = "Demo order from Songa Airside Sandbox Merchant at JKIA. Not a real airport merchant fulfilment.";
    context = { airportCode, merchantName: "Songa Airside Sandbox Merchant", items: normalized, sandboxFulfilment: true };
    paypalItems = normalized.map((item) => ({ name: item.name, description: "Songa Airside Sandbox menu item", quantity: String(item.quantity), unit_amount: { currency_code: "USD", value: item.unitPrice.toFixed(2) }, category: "PHYSICAL_GOODS" }));
  } else {
    const product = PRODUCT_CATALOG[productId];
    productName = product.name;
    description = product.description;
    amount = product.amount;
    if (productId === "songa-trip-rescue") {
      const flightNumber = typeof body.flightNumber === "string" ? body.flightNumber.toUpperCase().replace(/\s+/g, "") : "";
      const travelDate = typeof body.travelDate === "string" ? body.travelDate : "";
      if (!/^[A-Z0-9]{2,10}$/.test(flightNumber) || !validDate(travelDate)) return json({ error: "flight_required", message: "Trip Rescue requires a valid flight number and travel date." }, 400);
      if (!await verifyFlight(flightNumber, travelDate)) return json({ error: "flight_not_verified", message: "Songa could not verify this flight against the connected provider. Search again before purchasing." }, 409);
      context = { flightNumber, travelDate };
    }
    if (productId === "songa-family-watch") {
      const groupName = typeof body.groupName === "string" ? body.groupName.trim().slice(0, 60) : "Family journey";
      const memberEmails = Array.isArray(body.memberEmails) ? body.memberEmails.filter((value): value is string => typeof value === "string" && validEmail(value)).map((value) => value.toLowerCase()).filter((value) => value !== user.email?.toLowerCase()).slice(0, 5) : [];
      context = { groupName: groupName || "Family journey", memberEmails };
    }
    if (productId === "songa-gift-watch") {
      const beneficiaryEmail = typeof body.beneficiaryEmail === "string" ? body.beneficiaryEmail.trim().toLowerCase() : "";
      if (beneficiaryEmail && !validEmail(beneficiaryEmail)) return json({ error: "invalid_email", message: "Enter a valid recipient email address." }, 400);
      context = { beneficiaryEmail: beneficiaryEmail || null };
    }
    paypalItems = [{ name: productName, description, quantity: "1", unit_amount: { currency_code: "USD", value: amount.toFixed(2) }, category: "DIGITAL_GOODS" }];
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > 500) return json({ error: "invalid_amount", message: "The order total is not valid." }, 400);
  try {
    const accessToken = await paypalAccessToken();
    const localOrderId = crypto.randomUUID();
    const purchaseUnit: Record<string, unknown> = {
      reference_id: localOrderId,
      custom_id: localOrderId,
      description: description.slice(0, 127),
      items: paypalItems,
      amount: {
        currency_code: "USD",
        value: amount.toFixed(2),
        breakdown: { item_total: { currency_code: "USD", value: amount.toFixed(2) } },
      },
    };
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json", "PayPal-Request-Id": localOrderId },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [purchaseUnit],
        application_context: {
          brand_name: "Songa AI",
          user_action: "PAY_NOW",
          return_url: `${APP_URL}/?songa_commerce=success`,
          cancel_url: `${APP_URL}/?songa_commerce=cancel`,
          shipping_preference: "NO_SHIPPING",
        },
      }),
      signal: AbortSignal.timeout(16000),
    });
    const paypalOrder = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof paypalOrder.id !== "string") {
      console.error("Songa commerce PayPal order failed", response.status, paypalOrder.name ?? "unknown");
      return json({ error: "paypal_create_failed", message: "PayPal could not start checkout. Please try again." }, 502);
    }
    const links = Array.isArray(paypalOrder.links) ? paypalOrder.links as Array<Record<string, unknown>> : [];
    const approvalUrl = links.find((link) => ["approve", "payer-action"].includes(String(link.rel)))?.href;
    if (typeof approvalUrl !== "string") return json({ error: "paypal_approval_missing", message: "PayPal did not return an approval link." }, 502);
    const { error: storeError } = await admin.from("songa_commerce_orders").insert({
      id: localOrderId,
      paypal_order_id: paypalOrder.id,
      user_id: user.id,
      product_id: productId,
      product_name: productName,
      amount: amount.toFixed(2),
      currency_code: "USD",
      payment_status: "CREATED",
      fulfilment_status: "PENDING",
      context,
    });
    if (storeError) {
      console.error("Unable to persist Songa commerce order", storeError.code);
      return json({ error: "order_store_failed", message: "Songa could not save the checkout record. No payment has been captured." }, 500);
    }
    return json({ orderId: paypalOrder.id, approvalUrl, amount: amount.toFixed(2), currency: "USD", productId, productName });
  } catch (error) {
    console.error("Songa commerce create-order error", error instanceof Error ? error.message : "unknown");
    return json({ error: "commerce_unavailable", message: "Songa checkout is temporarily unavailable." }, 502);
  }
});
