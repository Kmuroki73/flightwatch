const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type LinkBody = {
  action: "status" | "start" | "verify" | "disconnect" | "preferences";
  phone?: string;
  code?: string;
  consent?: boolean;
  preferences?: {
    notifyDelayChanges?: boolean;
    notifyCancellationDiversion?: boolean;
    notifyDepartureChanges?: boolean;
    notifyArrivalUpdates?: boolean;
  };
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? "";

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function twilioConfigured(): boolean {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM);
}

async function sendTwilioWhatsApp(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: TWILIO_WHATSAPP_FROM.startsWith("whatsapp:") ? TWILIO_WHATSAPP_FROM : `whatsapp:${TWILIO_WHATSAPP_FROM}`,
    Body: body,
  });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message)
      : `Twilio responded with status ${response.status}`;
    return { ok: false, error: message };
  }
  const sid = payload && typeof payload === "object" && "sid" in payload ? String((payload as { sid?: unknown }).sid) : undefined;
  return { ok: true, sid };
}

async function logMessage(entry: {
  messageSid?: string;
  userId?: string;
  direction: "inbound" | "outbound";
  from?: string;
  to?: string;
  body?: string;
  commandKind?: "stop" | "help" | "flight_query" | "other" | null;
  deliveryStatus: "queued" | "sent" | "delivered" | "failed" | "suppressed";
  errorMessage?: string;
}): Promise<void> {
  await adminClient.from("whatsapp_message_log").insert({
    message_sid: entry.messageSid ?? null,
    user_id: entry.userId ?? null,
    direction: entry.direction,
    from_e164: entry.from ?? null,
    to_e164: entry.to ?? null,
    body: entry.body ?? null,
    command_kind: entry.commandKind ?? null,
    delivery_status: entry.deliveryStatus,
    error_message: entry.errorMessage ?? null,
  });
}

function normalizeToE164(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  if (compact.startsWith("+")) {
    return /^\+[1-9][0-9]{7,14}$/.test(compact) ? compact : null;
  }
  if (/^[1-9][0-9]{7,14}$/.test(compact)) return `+${compact}`;
  return null;
}

async function verifyTwilioCode(phoneE164: string, code: string): Promise<{ ok: boolean; error?: string }> {
  // Twilio Verify is the supported server-side verification product. When a
  // Verify service is configured we delegate to it; otherwise we fall back to
  // a self-managed code (sent as a WhatsApp message) checked against the hash.
  const verifyServiceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");
  if (verifyServiceSid) {
    const checkResponse = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phoneE164, Code: code }).toString(),
      },
    );
    const payload = await checkResponse.json().catch(() => null);
    if (!checkResponse.ok) {
      const message = payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : `Twilio Verify responded with status ${checkResponse.status}`;
      return { ok: false, error: message };
    }
    const valid = payload && typeof payload === "object" && "valid" in payload
      ? (payload as { valid?: unknown }).valid === true
      : false;
    return valid ? { ok: true } : { ok: false, error: "The code is not valid. Request a new one if it has expired." };
  }

  // Self-managed fallback: compare against the stored hash.
  const { data: connection } = await adminClient
    .from("whatsapp_connections")
    .select("verification_code_hash, verification_expires_at, verification_attempts")
    .eq("phone_e164", phoneE164)
    .eq("status", "pending_verification")
    .maybeSingle();
  if (!connection) return { ok: false, error: "No pending verification for this number. Start linking again." };
  if (connection.verification_attempts >= 5) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }
  if (!connection.verification_code_hash || !connection.verification_expires_at) {
    return { ok: false, error: "No verification code is pending. Start linking again." };
  }
  if (new Date(connection.verification_expires_at).getTime() < Date.now()) {
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  const expected = connection.verification_code_hash as string;
  const actual = await hashCode(phoneE164, code);
  if (expected !== actual) {
    await adminClient
      .from("whatsapp_connections")
      .update({ verification_attempts: (connection.verification_attempts as number) + 1 })
      .eq("phone_e164", phoneE164)
      .eq("status", "pending_verification");
    return { ok: false, error: "That code is not correct." };
  }
  return { ok: true };
}

async function hashCode(phoneE164: string, code: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${phoneE164}:${code}`));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "unauthenticated", message: "Sign in to Songa before linking WhatsApp." }, 401);

    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "unauthenticated", message: "Your session is no longer valid. Sign in again." }, 401);
    }
    const userId = userData.user.id;

    let body: LinkBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_request", message: "Body must be valid JSON." }, 400);
    }

    const { data: existing } = await adminClient
      .from("whatsapp_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    switch (body.action) {
      case "status": {
        return json({
          connection: existing ? {
            status: existing.status,
            phone: existing.status === "verified" ? existing.phone_e164 : null,
            notificationsEnabled: existing.notifications_enabled && existing.status === "verified",
            consentGivenAt: existing.consent_given_at,
            preferences: {
              notifyDelayChanges: existing.notify_delay_changes,
              notifyCancellationDiversion: existing.notify_cancellation_diversion,
              notifyDepartureChanges: existing.notify_departure_changes,
              notifyArrivalUpdates: existing.notify_arrival_updates,
            },
            linkedAt: existing.linked_at,
          } : null,
          twilioConfigured: twilioConfigured(),
        });
      }

      case "start": {
        const phoneE164 = normalizeToE164(body.phone ?? "");
        if (!phoneE164) {
          return json({ error: "invalid_request", message: "Enter a WhatsApp number in international format, e.g. +254712345678." }, 400);
        }
        if (existing?.status === "verified" && existing.phone_e164 === phoneE164) {
          return json({ error: "already_linked", message: "That number is already linked to your account." }, 409);
        }
        if (!twilioConfigured()) {
          return json({
            error: "not_configured",
            message: "WhatsApp messaging is not configured yet. Add the Twilio secrets in the Supabase dashboard (Edge Functions → Secrets): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.",
          }, 503);
        }

        const verifyServiceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");
        let verificationSent = false;
        let sendError: string | undefined;

        if (verifyServiceSid) {
          const startResponse = await fetch(`https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`, {
            method: "POST",
            headers: {
              "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ To: phoneE164, Channel: "whatsapp" }).toString(),
          });
          const payload = await startResponse.json().catch(() => null);
          if (!startResponse.ok) {
            sendError = payload && typeof payload === "object" && "message" in payload
              ? String((payload as { message?: unknown }).message)
              : `Twilio Verify responded with status ${startResponse.status}`;
          } else {
            verificationSent = true;
          }
        } else {
          // Self-managed six-digit code, sent as a WhatsApp message from the
          // sandbox/production sender. Only the HMAC hash is stored.
          const code = String(Math.floor(100000 + Math.random() * 900000));
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          const codeHash = await hashCode(phoneE164, code);

          const upsertPayload = {
            user_id: userId,
            phone_e164: phoneE164,
            status: "pending_verification",
            verification_code_hash: codeHash,
            verification_expires_at: expiresAt,
            verification_attempts: 0,
          };
          const { error: upsertError } = await adminClient
            .from("whatsapp_connections")
            .upsert(upsertPayload, { onConflict: "user_id" });
          if (upsertError) {
            return json({ error: "internal", message: "The verification could not be started. Try again." }, 500);
          }

          const send = await sendTwilioWhatsApp(
            phoneE164,
            `Songa Flight Watch: your verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this message.`,
          );
          if (send.ok) {
            verificationSent = true;
            await logMessage({
              messageSid: send.sid,
              userId,
              direction: "outbound",
              to: phoneE164,
              body: "Verification code sent",
              deliveryStatus: "sent",
            });
          } else {
            sendError = send.error;
            await logMessage({
              userId,
              direction: "outbound",
              to: phoneE164,
              body: "Verification code send failed",
              deliveryStatus: "failed",
              errorMessage: send.error,
            });
          }
        }

        if (!verificationSent) {
          return json({ error: "send_failed", message: sendError ?? "The verification message could not be sent." }, 502);
        }
        return json({ ok: true, phone: phoneE164, delivery: verifyServiceSid ? "twilio_verify" : "whatsapp_message" });
      }

      case "verify": {
        const phoneE164 = normalizeToE164(body.phone ?? "");
        const code = (body.code ?? "").replace(/\D/g, "");
        if (!phoneE164 || !code) {
          return json({ error: "invalid_request", message: "Provide the phone number and the 6-digit code." }, 400);
        }
        if (!existing) {
          return json({ error: "not_started", message: "Start linking your number first." }, 409);
        }

        const check = await verifyTwilioCode(phoneE164, code);
        if (!check.ok) {
          return json({ error: "invalid_code", message: check.error }, 400);
        }

        // Claim the phone: refuse if another user has it verified.
        const { data: clash } = await adminClient
          .from("whatsapp_connections")
          .select("user_id")
          .eq("phone_e164", phoneE164)
          .eq("status", "verified")
          .maybeSingle();
        if (clash && clash.user_id !== userId) {
          return json({ error: "phone_taken", message: "That WhatsApp number is already linked to another Songa account." }, 409);
        }

        const { error: updateError } = await adminClient
          .from("whatsapp_connections")
          .upsert({
            user_id: userId,
            phone_e164: phoneE164,
            status: "verified",
            verification_code_hash: null,
            verification_expires_at: null,
            verification_attempts: 0,
            linked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        if (updateError) {
          return json({ error: "internal", message: "The number could not be linked. Try again." }, 500);
        }
        return json({ ok: true, status: "verified", phone: phoneE164 });
      }

      case "disconnect": {
        const { error: deleteError } = await adminClient
          .from("whatsapp_connections")
          .delete()
          .eq("user_id", userId);
        if (deleteError) {
          return json({ error: "internal", message: "The connection could not be removed. Try again." }, 500);
        }
        return json({ ok: true, status: "disconnected" });
      }

      case "preferences": {
        if (!existing || existing.status !== "verified") {
          return json({ error: "not_verified", message: "Link and verify your WhatsApp number before changing notifications." }, 409);
        }

        if (body.consent === true && !existing.consent_given_at) {
          // Enabling notifications requires explicit consent.
          const { error: consentError } = await adminClient
            .from("whatsapp_connections")
            .update({ consent_given_at: new Date().toISOString(), notifications_enabled: true, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
          if (consentError) {
            return json({ error: "internal", message: "Consent could not be recorded. Try again." }, 500);
          }
        }

        if (body.consent === false) {
          const { error: revokeError } = await adminClient
            .from("whatsapp_connections")
            .update({ consent_given_at: null, notifications_enabled: false, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
          if (revokeError) {
            return json({ error: "internal", message: "Consent could not be revoked. Try again." }, 500);
          }
        }

        if (body.preferences) {
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (typeof body.preferences.notifyDelayChanges === "boolean") patch.notify_delay_changes = body.preferences.notifyDelayChanges;
          if (typeof body.preferences.notifyCancellationDiversion === "boolean") patch.notify_cancellation_diversion = body.preferences.notifyCancellationDiversion;
          if (typeof body.preferences.notifyDepartureChanges === "boolean") patch.notify_departure_changes = body.preferences.notifyDepartureChanges;
          if (typeof body.preferences.notifyArrivalUpdates === "boolean") patch.notify_arrival_updates = body.preferences.notifyArrivalUpdates;
          const { error: prefError } = await adminClient
            .from("whatsapp_connections")
            .update(patch)
            .eq("user_id", userId);
          if (prefError) {
            return json({ error: "internal", message: "The preferences could not be saved. Try again." }, 500);
          }
        }

        // Master switch off: pause everything.
        if (body.consent === false) {
          return json({ ok: true, notificationsEnabled: false });
        }
        return json({ ok: true });
      }

      default:
        return json({ error: "invalid_request", message: "Unknown action." }, 400);
    }
  } catch (err) {
    return json({ error: "internal", message: err instanceof Error ? err.message : "Unexpected server error." }, 500);
  }
});
