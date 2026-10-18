const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? "";
const AEROAPI_KEY = Deno.env.get("AEROAPI_API_KEY") ?? Deno.env.get("AEROAPI_KEY") ?? "";

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type InboundFields = Record<string, string>;

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function twilioConfigured(): boolean {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM);
}

// Twilio signs webhook requests with HMAC-SHA1 over the full request URL plus
// alphabetically sorted POST parameters. The signature arrives in
// X-Twilio-Signature; requests that do not carry a valid signature are
// rejected before any processing.
async function isValidTwilioSignature(url: string, params: InboundFields, signature: string): Promise<boolean> {
  if (!TWILIO_AUTH_TOKEN || !signature) return false;
  const data = url + Object.keys(params).sort().map((key) => key + params[key]).join("");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TWILIO_AUTH_TOKEN),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  // Expected value is base64 of the HMAC digest.
  const digestBytes = new Uint8Array(mac);
  let binary = "";
  for (const byte of digestBytes) binary += String.fromCharCode(byte);
  const expectedBase64 = btoa(binary);
  return expectedBase64 === signature;
}

async function sendWhatsApp(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
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
}): Promise<boolean> {
  // The unique constraint on message_sid makes this idempotent: a retried
  // webhook with the same MessageSid fails with 23505 and we treat the
  // message as already processed.
  const { error } = await adminClient.from("whatsapp_message_log").insert({
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
  if (error && error.code === "23505") return false;
  return true;
}

function parseFlightNumber(text: string): string | null {
  const match = text.match(/^([A-Z]{1,3})\s*[-]?\s*(\d{1,4}[A-Z]?)$/i);
  if (!match) return null;
  return `${match[1].toUpperCase()}${match[2].toUpperCase()}`;
}

async function lookupFlight(ident: string): Promise<{ reply: string } | { error: string }> {
  if (!AEROAPI_KEY) {
    return { error: "Flight data is not configured on our side right now. Please try again later." };
  }
  const lookback = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const lookahead = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(ident)}?start=${lookback}&end=${lookahead}&max_pages=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { "x-apikey": AEROAPI_KEY },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { error: "I could not reach the flight data provider just now. Please try again in a moment." };
    }
    const payload = await response.json().catch(() => null);
    const flights = payload && typeof payload === "object" && payload !== null && "flights" in payload
      ? (payload as { flights?: unknown }).flights
      : null;
    if (!Array.isArray(flights) || !flights.length) {
      return { reply: `I could not find any flight matching ${ident} in the current provider window. Check the number and try again.` };
    }
    const flight = flights[0] as Record<string, unknown>;
    const origin = flight.origin as Record<string, unknown> | undefined;
    const destination = flight.destination as Record<string, unknown> | undefined;
    const identOut = typeof flight.ident === "string" ? flight.ident : ident;
    const status = typeof flight.status === "string" ? flight.status : "Unknown";
    const cancelled = flight.cancelled === true || status.toLowerCase().includes("cancelled");
    const diverted = flight.diverted === true || status.toLowerCase().includes("diverted");

    const lines: string[] = [];
    lines.push(`${identOut} — provider status: ${cancelled ? "Cancelled" : diverted ? "Diverted" : status || "Unknown"}`);
    if (origin && typeof origin === "object") {
      const code = (origin.code_iata ?? origin.code) as string | undefined;
      const city = (origin.city ?? code) as string | undefined;
      const scheduled = (flight.scheduled_off ?? flight.scheduled_departure) as string | undefined;
      const estimated = (flight.estimated_off ?? flight.estimated_departure) as string | undefined;
      const actual = (flight.actual_off ?? flight.actual_departure) as string | undefined;
      const time = actual ?? estimated ?? scheduled;
      lines.push(`From: ${city ?? code ?? "Unknown"}${code ? ` (${code})` : ""}${time ? `\nDeparture: ${time}` : ""}`);
    }
    if (destination && typeof destination === "object") {
      const code = (destination.code_iata ?? destination.code) as string | undefined;
      const city = (destination.city ?? code) as string | undefined;
      const scheduled = (flight.scheduled_in ?? flight.scheduled_arrival) as string | undefined;
      const estimated = (flight.estimated_in ?? flight.estimated_arrival) as string | undefined;
      const actual = (flight.actual_in ?? flight.actual_arrival) as string | undefined;
      const time = actual ?? estimated ?? scheduled;
      lines.push(`To: ${city ?? code ?? "Unknown"}${code ? ` (${code})` : ""}${time ? `\nArrival: ${time}` : ""}`);
    }
    const delayMinutes = typeof flight.departure_delay === "number" && Number.isFinite(flight.departure_delay)
      ? Math.round((flight.departure_delay as number) / 60)
      : null;
    if (delayMinutes != null && delayMinutes >= 15) {
      lines.push(`Departure delay: about ${delayMinutes} minutes (reported by the provider).`);
    }
    lines.push("Times are UTC. This is the latest provider data, not a guarantee from the airline.");
    return { reply: lines.join("\n") };
  } catch {
    return { error: "I could not reach the flight data provider just now. Please try again in a moment." };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed", message: "Use POST." }, 405);
    }
    if (!twilioConfigured()) {
      return json({ error: "not_configured", message: "Twilio is not configured." }, 503);
    }

    const form = await req.formData();
    const params: InboundFields = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") params[key] = value;
    }

    const signature = req.headers.get("X-Twilio-Signature") ?? "";
    const requestUrl = new URL(req.url).toString();
    const signatureValid = await isValidTwilioSignature(requestUrl, params, signature);
    if (!signatureValid) {
      return json({ error: "invalid_signature", message: "The request did not come from Twilio." }, 403);
    }

    const from = (params.From ?? "").replace("whatsapp:", "");
    const to = (params.To ?? "").replace("whatsapp:", "");
    const messageSid = params.MessageSid ?? null;
    const bodyText = (params.Body ?? "").trim();
    const upper = bodyText.toUpperCase();

    // Idempotency: a repeated MessageSid is a Twilio retry; skip processing.
    const isNew = await logMessage({
      messageSid: messageSid ?? undefined,
      direction: "inbound",
      from,
      to,
      body: bodyText,
      commandKind: upper === "STOP" || upper === "UNSUBSCRIBE" || upper === "CANCEL" ? "stop" : upper === "HELP" ? "help" : parseFlightNumber(bodyText) ? "flight_query" : "other",
      deliveryStatus: "delivered",
    });
    if (!isNew) {
      return json({ ok: true, duplicate: true });
    }

    // Opt-out always wins, regardless of link state.
    if (upper === "STOP" || upper === "UNSUBSCRIBE" || upper === "CANCEL") {
      const { data: conn } = await adminClient
        .from("whatsapp_connections")
        .update({ notifications_enabled: false, consent_given_at: null, updated_at: new Date().toISOString() })
        .eq("phone_e164", from)
        .select("user_id")
        .maybeSingle();
      const reply = "You are unsubscribed from Songa Flight Watch notifications. Reply HELP for info or START to resubscribe.";
      const send = await sendWhatsApp(from, reply);
      await logMessage({
        messageSid: send.sid,
        userId: conn?.user_id ?? undefined,
        direction: "outbound",
        to: from,
        body: reply,
        deliveryStatus: send.ok ? "sent" : "failed",
        errorMessage: send.error,
      });
      return json({ ok: true });
    }

    if (upper === "HELP") {
      const reply = "Songa Flight Watch: send a flight number (e.g. KQ100) for the latest status. Reply STOP to unsubscribe.";
      const send = await sendWhatsApp(from, reply);
      await logMessage({
        direction: "outbound",
        to: from,
        body: reply,
        deliveryStatus: send.ok ? "sent" : "failed",
        errorMessage: send.error,
      });
      return json({ ok: true });
    }

    if (upper === "START") {
      const reply = "Welcome back. Open the Songa app to re-enable notifications for your linked account.";
      const send = await sendWhatsApp(from, reply);
      await logMessage({
        direction: "outbound",
        to: from,
        body: reply,
        deliveryStatus: send.ok ? "sent" : "failed",
        errorMessage: send.error,
      });
      return json({ ok: true });
    }

    const flightIdent = parseFlightNumber(bodyText);
    if (flightIdent) {
      const result = await lookupFlight(flightIdent);
      const reply = "reply" in result ? result.reply : result.error;
      const send = await sendWhatsApp(from, reply);
      await logMessage({
        direction: "outbound",
        to: from,
        body: reply,
        commandKind: "flight_query",
        deliveryStatus: send.ok ? "sent" : "failed",
        errorMessage: send.error,
      });
      return json({ ok: true });
    }

    const reply = "I did not recognise that. Send a flight number like KQ100, or reply HELP for options, STOP to unsubscribe.";
    const send = await sendWhatsApp(from, reply);
    await logMessage({
      direction: "outbound",
      to: from,
      body: reply,
      deliveryStatus: send.ok ? "sent" : "failed",
      errorMessage: send.error,
    });
    return json({ ok: true });
  } catch (err) {
    return json({ error: "internal", message: err instanceof Error ? err.message : "Unexpected server error." }, 500);
  }
});
