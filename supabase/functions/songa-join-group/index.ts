import { admin, authenticatedUser, json } from "../_shared/commerce.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!admin) return json({ error: "not_configured" }, 503);
  const { user, error: authError } = await authenticatedUser(req);
  if (!user) return json({ error: "unauthenticated", message: authError ?? "Sign in to join a group." }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const shareCode = typeof body.shareCode === "string" ? body.shareCode.trim().toUpperCase() : "";
  if (!/^FAMILY-[A-F0-9]{12}$/.test(shareCode)) return json({ error: "invalid_code", message: "Enter a valid Family Watch invitation code." }, 400);
  const { data: group, error: groupError } = await admin.from("songa_group_journeys").select("id,owner_user_id,group_name,share_code,journey_limit,source_entitlement_id").eq("share_code", shareCode).maybeSingle();
  if (groupError || !group) return json({ error: "group_not_found", message: "This family journey could not be found." }, 404);
  if (group.owner_user_id === user.id) return json({ joined: true, groupId: group.id, groupName: group.group_name, message: "You are the owner of this family journey." });
  const { count } = await admin.from("songa_group_members").select("id", { count: "exact", head: true }).eq("group_id", group.id).eq("status", "ACCEPTED");
  if ((count ?? 0) >= group.journey_limit) return json({ error: "group_full", message: "This family journey has reached its member limit." }, 409);
  const email = (user.email ?? "").toLowerCase();
  const { data: existing } = await admin.from("songa_group_members").select("id,status").eq("group_id", group.id).eq("invited_email", email).maybeSingle();
  if (existing?.status === "ACCEPTED") return json({ joined: true, groupId: group.id, groupName: group.group_name, message: "You already belong to this family journey." });
  if (existing) {
    const { error } = await admin.from("songa_group_members").update({ member_user_id: user.id, status: "ACCEPTED" }).eq("id", existing.id);
    if (error) return json({ error: "join_failed", message: "Songa could not accept the invitation." }, 500);
  } else {
    const { error } = await admin.from("songa_group_members").insert({ group_id: group.id, invited_email: email, member_user_id: user.id, status: "ACCEPTED" });
    if (error) return json({ error: "join_failed", message: "Songa could not accept the invitation." }, 500);
  }
  return json({ joined: true, groupId: group.id, groupName: group.group_name, message: `You joined ${group.group_name}.` });
});
