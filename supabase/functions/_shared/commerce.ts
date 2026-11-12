import { createClient } from "npm:@supabase/supabase-js@2.57.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, PayPal-Transmission-Id, PayPal-Transmission-Time, PayPal-Transmission-Sig, PayPal-Cert-Url, PayPal-Auth-Algo",
};
export const ENVIRONMENT = (Deno.env.get("PAYPAL_ENVIRONMENT") ?? "sandbox").toLowerCase();
export const PAYPAL_API = ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
export const CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
export const CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") ?? "";
export const WEBHOOK_ID = Deno.env.get("PAYPAL_COMMERCE_WEBHOOK_ID") ?? "";
export const APP_URL = (Deno.env.get("SONGA_APP_URL") ?? "https://songa.co.ke").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const admin = SUPABASE_URL && SERVICE_ROLE
  ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  : null;

export type ProductId = "songa-premium-30" | "songa-premium-365" | "songa-trip-rescue" | "songa-family-watch" | "songa-gift-watch" | "songa-airside-order";
export const AIRSIDE_MENU = {
  "coffee-pastry": { name: "Coffee & pastry", description: "Fresh coffee and pastry · Sandbox menu", price: 5.5 },
  "chicken-wrap": { name: "Chicken wrap meal", description: "Chicken wrap meal · Sandbox menu", price: 8.5 },
  "water": { name: "Bottled water", description: "Bottled water · Sandbox menu", price: 1.5 },
  "snack-box": { name: "Travel snack box", description: "Travel snack box · Sandbox menu", price: 4.5 },
} as const;

export const PRODUCT_CATALOG: Record<Exclude<ProductId, "songa-airside-order">, { name: string; description: string; amount: number }> = {
  "songa-premium-30": { name: "Songa Premium · 30-day pass", description: "30 days of enhanced Songa travel intelligence. Prepaid pass; does not auto-renew.", amount: 25 },
  "songa-premium-365": { name: "Songa Premium · 365-day pass", description: "365 days of enhanced Songa travel intelligence. Prepaid pass; does not auto-renew.", amount: 250 },
  "songa-trip-rescue": { name: "Songa Trip Rescue", description: "AI-assisted disruption recovery report and personalised action plan for one flight.", amount: 4.99 },
  "songa-family-watch": { name: "Songa Family & Group Watch", description: "A 14-day group journey pass with up to five flight journey slots.", amount: 9.99 },
  "songa-gift-watch": { name: "Songa Gift a Journey Watch", description: "A giftable 14-day journey watch pass for one traveller.", amount: 4.99 },
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function paypalAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("PayPal credentials are not configured.");
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Authorization": `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") throw new Error("PayPal authentication failed.");
  return payload.access_token;
}

export async function authenticatedUser(req: Request) {
  if (!admin) return { user: null, error: "Commerce is not configured on the Songa server." };
  const authorization = req.headers.get("Authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (!jwt || jwt === authorization) return { user: null, error: "Please sign in to continue." };
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return { user: null, error: "Your Songa session has expired. Please sign in again." };
  return { user: data.user, error: null };
}

function randomCode(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${prefix}-${token}`;
}

type CommerceOrder = {
  id: string;
  user_id: string;
  product_id: ProductId;
  amount: string | number;
  currency_code: string;
  context: unknown;
};

export async function fulfilCommerceOrder(order: CommerceOrder) {
  if (!admin) throw new Error("Commerce database is not configured.");
  const now = new Date();
  const metadata = (order.context && typeof order.context === "object" ? order.context : {}) as Record<string, unknown>;

  // Airside is a merchant order, not a travel entitlement.
  if (order.product_id === "songa-airside-order") {
    const { data: existingAirside } = await admin.from("songa_airside_orders").select("id,pickup_reference,fulfilment_status").eq("commerce_order_id", order.id).maybeSingle();
    if (existingAirside) return { entitlementId: null, giftCode: null, airsideOrder: existingAirside };
    const pickupReference = randomCode("AS-NBO");
    const items: unknown[] = Array.isArray(metadata.items) ? metadata.items : [];
    const { data: airside, error } = await admin.from("songa_airside_orders").insert({
      commerce_order_id: order.id, user_id: order.user_id, airport_code: "NBO",
      merchant_name: "Songa Airside Sandbox Merchant", pickup_reference: pickupReference,
      fulfilment_status: "PAID_SANDBOX_AWAITING_MERCHANT", items,
      total: order.amount, currency_code: order.currency_code,
    }).select("id,pickup_reference,fulfilment_status").single();
    if (error) throw error;
    const { error: updateError } = await admin.from("songa_commerce_orders").update({ fulfilment_status: "AWAITING_MERCHANT", fulfilled_at: now.toISOString() }).eq("id", order.id);
    if (updateError) throw updateError;
    return { entitlementId: null, giftCode: null, airsideOrder: airside };
  }

  const { data: existing } = await admin.from("songa_commerce_entitlements").select("id,gift_code,product_id").eq("source_order_id", order.id).maybeSingle();
  if (existing) {
    if (order.product_id === "songa-family-watch") {
      let { data: group } = await admin.from("songa_group_journeys").select("id,share_code").eq("source_entitlement_id", existing.id).maybeSingle();
      // Recover a partially fulfilled purchase (e.g. entitlement inserted but
      // group creation failed) instead of returning a paid order with no group.
      if (!group) {
        const groupCode = randomCode("FAMILY");
        const groupName = typeof metadata.groupName === "string" && metadata.groupName.trim() ? metadata.groupName.trim().slice(0, 60) : "Family journey";
        const { data: createdGroup, error: groupError } = await admin.from("songa_group_journeys").insert({
          source_entitlement_id: existing.id, owner_user_id: order.user_id,
          group_name: groupName, share_code: groupCode, journey_limit: 5,
          metadata: { travelWindowDays: 14 },
        }).select("id,share_code").single();
        if (groupError) throw groupError;
        group = createdGroup;
      }
      const emails = Array.isArray(metadata.memberEmails)
        ? metadata.memberEmails.filter((email): email is string => typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 5)
        : [];
      if (emails.length) {
        const rows = emails.map((email) => ({ group_id: group!.id, invited_email: email.toLowerCase() }));
        const { error } = await admin.from("songa_group_members").upsert(rows, { onConflict: "group_id,invited_email", ignoreDuplicates: true });
        if (error) throw error;
      }
      const { error: updateError } = await admin.from("songa_commerce_orders").update({ fulfilment_status: "ISSUED", fulfilled_at: now.toISOString() }).eq("id", order.id);
      if (updateError) throw updateError;
      return { entitlementId: existing.id, groupCode: group?.share_code ?? null, giftCode: null, airsideOrder: null };
    }
    return { entitlementId: existing.id, giftCode: existing.gift_code ?? null, airsideOrder: null };
  }

  let status = "ACTIVE";
  let endsAt: string | null = null;
  let maxJourneys = 1;
  let giftCode: string | null = null;
  let beneficiaryEmail: string | null = null;
  if (order.product_id === "songa-premium-30") endsAt = new Date(now.getTime() + 30 * 86400000).toISOString();
  if (order.product_id === "songa-premium-365") endsAt = new Date(now.getTime() + 365 * 86400000).toISOString();
  if (order.product_id === "songa-trip-rescue") {
    endsAt = new Date(now.getTime() + 30 * 86400000).toISOString();
    metadata.flightNumber = String(metadata.flightNumber ?? "").toUpperCase();
    maxJourneys = 1;
  }
  if (order.product_id === "songa-family-watch") {
    endsAt = new Date(now.getTime() + 14 * 86400000).toISOString();
    maxJourneys = 5;
  }
  if (order.product_id === "songa-gift-watch") {
    endsAt = new Date(now.getTime() + 14 * 86400000).toISOString();
    status = "PENDING_CLAIM";
    giftCode = randomCode("SONGA");
    beneficiaryEmail = typeof metadata.beneficiaryEmail === "string" ? metadata.beneficiaryEmail.toLowerCase() : null;
  }
  const { data: entitlement, error: entitlementError } = await admin.from("songa_commerce_entitlements").insert({
    source_order_id: order.id,
    purchaser_user_id: order.user_id,
    product_id: order.product_id,
    status,
    starts_at: now.toISOString(),
    ends_at: endsAt,
    max_journeys: maxJourneys,
    beneficiary_email: beneficiaryEmail,
    gift_code: giftCode,
    metadata,
  }).select("id,gift_code,product_id").single();
  if (entitlementError) throw entitlementError;

  if (order.product_id === "songa-family-watch") {
    const groupCode = randomCode("FAMILY");
    const groupName = typeof metadata.groupName === "string" && metadata.groupName.trim() ? metadata.groupName.trim().slice(0, 60) : "Family journey";
    const { data: group, error: groupError } = await admin.from("songa_group_journeys").insert({
      source_entitlement_id: entitlement.id, owner_user_id: order.user_id,
      group_name: groupName, share_code: groupCode, journey_limit: 5,
      metadata: { travelWindowDays: 14 },
    }).select("id,share_code").single();
    if (groupError) throw groupError;
    const emails = Array.isArray(metadata.memberEmails)
      ? metadata.memberEmails.filter((email): email is string => typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 5)
      : [];
    if (emails.length) {
      const rows = emails.map((email) => ({ group_id: group.id, invited_email: email.toLowerCase() }));
      const { error } = await admin.from("songa_group_members").upsert(rows, { onConflict: "group_id,invited_email", ignoreDuplicates: true });
      if (error) throw error;
    }
    const { error: updateError } = await admin.from("songa_commerce_orders").update({ fulfilment_status: "ISSUED", fulfilled_at: now.toISOString() }).eq("id", order.id);
    if (updateError) throw updateError;
    return { entitlementId: entitlement.id, groupCode: group.share_code, giftCode: null, airsideOrder: null };
  }

  const fulfilmentStatus = order.product_id === "songa-gift-watch" ? "ISSUED" : "READY";
  const { error: updateError } = await admin.from("songa_commerce_orders").update({ fulfilment_status: fulfilmentStatus, fulfilled_at: now.toISOString() }).eq("id", order.id);
  if (updateError) throw updateError;
  return { entitlementId: entitlement.id, giftCode, airsideOrder: null };
}
