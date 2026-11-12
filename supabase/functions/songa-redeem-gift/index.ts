import { admin, authenticatedUser, json } from "../_shared/commerce.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!admin) return json({ error: "not_configured" }, 503);
  const { user, error: authError } = await authenticatedUser(req);
  if (!user) return json({ error: "unauthenticated", message: authError ?? "Sign in to redeem a gift." }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const giftCode = typeof body.giftCode === "string" ? body.giftCode.trim().toUpperCase() : "";
  if (!/^SONGA-[A-F0-9]{12}$/.test(giftCode)) return json({ error: "invalid_code", message: "Enter a valid Songa gift code." }, 400);
  const { data: gift, error: lookupError } = await admin.from("songa_commerce_entitlements").select("id,beneficiary_email,status,ends_at").eq("gift_code", giftCode).maybeSingle();
  if (lookupError || !gift) return json({ error: "gift_not_found", message: "This gift code could not be found." }, 404);
  if (gift.status !== "PENDING_CLAIM") return json({ error: "gift_already_claimed", message: "This gift has already been claimed or is no longer available." }, 409);
  if (gift.ends_at && new Date(gift.ends_at).getTime() < Date.now()) return json({ error: "gift_expired", message: "This gift has expired." }, 410);
  if (gift.beneficiary_email && gift.beneficiary_email.toLowerCase() !== (user.email ?? "").toLowerCase()) return json({ error: "recipient_mismatch", message: "Sign in using the email address this gift was sent to." }, 403);
  const { data: claimed, error: claimError } = await admin.from("songa_commerce_entitlements")
    .update({ beneficiary_user_id: user.id, status: "CLAIMED", gift_claimed_at: new Date().toISOString() })
    .eq("id", gift.id).eq("status", "PENDING_CLAIM").select("id").maybeSingle();
  if (claimError) return json({ error: "claim_failed", message: "Songa could not claim this gift right now." }, 500);
  if (!claimed) return json({ error: "gift_already_claimed", message: "This gift has already been claimed by another account." }, 409);
  return json({ claimed: true, message: "Your Songa Journey Watch gift is now linked to your account." });
});
