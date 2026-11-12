import { admin, authenticatedUser, json } from "../_shared/commerce.ts";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!admin) return json({ error: "not_configured" }, 503);
  const { user, error: authError } = await authenticatedUser(req);
  if (!user) return json({ error: "unauthenticated", message: authError ?? "Sign in to add a flight." }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const groupId = typeof body.groupId === "string" ? body.groupId : "";
  const flightNumber = typeof body.flightNumber === "string" ? body.flightNumber.toUpperCase().replace(/\s+/g, "") : "";
  const travelDate = typeof body.travelDate === "string" ? body.travelDate : "";
  if (!/^[0-9a-f-]{36}$/i.test(groupId) || !/^[A-Z0-9]{2,10}$/.test(flightNumber) || !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return json({ error: "invalid_request", message: "Enter a valid group, flight number and travel date." }, 400);
  const { data: group } = await admin.from("songa_group_journeys").select("id,owner_user_id,journey_limit").eq("id", groupId).maybeSingle();
  if (!group) return json({ error: "group_not_found", message: "Family journey not found." }, 404);
  let canManage = group.owner_user_id === user.id;
  if (!canManage) {
    const { data: member } = await admin.from("songa_group_members").select("id").eq("group_id", groupId).eq("member_user_id", user.id).eq("status", "ACCEPTED").maybeSingle();
    canManage = !!member;
  }
  if (!canManage) return json({ error: "not_a_member", message: "You are not a member of this family journey." }, 403);
  const { count } = await admin.from("songa_group_flights").select("id", { count: "exact", head: true }).eq("group_id", groupId);
  if ((count ?? 0) >= group.journey_limit) return json({ error: "journey_limit", message: "This family pass has reached its five-journey limit." }, 409);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const response = await fetch(`${url}/functions/v1/flight-search`, { method: "POST", headers: { "Authorization": `Bearer ${serviceRole}`, "apikey": serviceRole, "Content-Type": "application/json" }, body: JSON.stringify({ flightNumber, travelDate }), signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!response?.ok) return json({ error: "flight_lookup_unavailable", message: "Songa could not verify this flight right now." }, 503);
  const payload = asRecord(await response.json().catch(() => ({})));
  const flights = Array.isArray(payload.flights) ? payload.flights.map(asRecord) : [];
  const flight = flights.find((item) => String(item.flightNumber ?? "").toUpperCase().replace(/\s+/g, "") === flightNumber);
  if (!flight) return json({ error: "flight_not_found", message: "No matching provider-backed flight was found." }, 404);
  const origin = asRecord(flight.origin);
  const destination = asRecord(flight.destination);
  const { data, error } = await admin.from("songa_group_flights").upsert({ group_id: groupId, added_by_user_id: user.id, flight_number: flightNumber, travel_date: travelDate, origin_code: typeof origin.code === "string" ? origin.code : null, destination_code: typeof destination.code === "string" ? destination.code : null, provider_status: typeof flight.status === "string" ? flight.status : null, provider_checked_at: new Date().toISOString() }, { onConflict: "group_id,flight_number,travel_date" }).select("id,flight_number,travel_date,origin_code,destination_code,provider_status,provider_checked_at").single();
  if (error) return json({ error: "save_failed", message: "Songa could not save this family flight." }, 500);
  return json({ saved: true, flight: data, message: "Flight added to the family journey." });
});
