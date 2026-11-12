import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { AIRSIDE_MENU, PRODUCT_CATALOG } from "../_shared/commerce.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-20b";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

type ChatMessage = { role: "user" | "assistant"; content: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function withinUsageLimit(req: Request): Promise<boolean> {
  if (!admin) return false;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const clientHash = await sha256(forwarded + (Deno.env.get("SONGA_RATE_LIMIT_SALT") ?? "songa-public-ai"));
  const since = new Date(Date.now() - 60_000).toISOString();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [{ count: minuteCount, error: minuteError }, { count: dayCount, error: dayError }] = await Promise.all([
    admin.from("songa_ai_usage").select("id", { count: "exact", head: true }).eq("client_hash", clientHash).gte("created_at", since),
    admin.from("songa_ai_usage").select("id", { count: "exact", head: true }).eq("client_hash", clientHash).gte("created_at", today.toISOString()),
  ]);
  if (minuteError || dayError) return false;
  if ((minuteCount ?? 0) >= 6 || (dayCount ?? 0) >= 35) return false;
  const { error } = await admin.from("songa_ai_usage").insert({ client_hash: clientHash });
  return !error;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!GROQ_API_KEY && !GEMINI_API_KEY) return json({ error: "not_configured", message: "Songa AI is not configured. Add GROQ_API_KEY and/or GEMINI_API_KEY to Supabase Function secrets." }, 503);
  if (!admin) return json({ error: "not_configured", message: "Songa AI usage controls are not configured." }, 503);

  let body: { messages?: ChatMessage[]; flight?: Record<string, unknown> | null; premium?: boolean };
  try { body = await req.json(); } catch { return json({ error: "invalid_request", message: "Request body must be valid JSON." }, 400); }
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages.slice(-10).filter((m): m is ChatMessage =>
    !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0,
  ).map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1200) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json({ error: "invalid_request", message: "Send a message to Songa AI first." }, 400);
  }
  if (!await withinUsageLimit(req)) return json({ error: "rate_limited", message: "Songa AI is receiving many requests. Please try again in a minute." }, 429);

  const candidateFlight = body.flight && typeof body.flight === "object" ? body.flight : null;
  const flight = candidateFlight?.dataMode === "live" ? candidateFlight : null;
  const authorization = req.headers.get("Authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  let signedInUser: { id: string } | null = null;
  if (jwt && jwt !== authorization) {
    const { data: userData } = await admin.auth.getUser(jwt);
    if (userData.user) signedInUser = { id: userData.user.id };
  }
  let travellerPersonalisation = "";
  if (signedInUser) {
    const { data: preferences } = await admin.from("songa_traveller_profiles")
      .select("display_name,home_airport,preferred_currency,travel_interests")
      .eq("user_id", signedInUser.id).maybeSingle();
    if (preferences) {
      const interests = Array.isArray(preferences.travel_interests) ? preferences.travel_interests.slice(0, 8).join(", ") : "";
      travellerPersonalisation = [
        preferences.display_name ? `Preferred name: ${preferences.display_name}.` : "",
        preferences.home_airport ? `Home airport: ${preferences.home_airport}.` : "",
        preferences.preferred_currency ? `Preferred currency: ${preferences.preferred_currency}.` : "",
        interests ? `Travel interests: ${interests}.` : "",
      ].filter(Boolean).join(" ");
    }
  }
  let premium = false;
  if (body.premium === true) {
    if (!signedInUser) return json({ error: "premium_sign_in_required", message: "Sign in to use Premium Travel Assistance." }, 401);
    const flightNumber = typeof candidateFlight?.flightNumber === "string" ? candidateFlight.flightNumber.toUpperCase().replace(/\s+/g, "") : "";
    const travelDate = typeof candidateFlight?.date === "string" ? candidateFlight.date : "";
    const legacyResult = flightNumber && /^\d{4}-\d{2}-\d{2}$/.test(travelDate)
      ? await admin.from("premium_entitlements").select("id").eq("user_id", signedInUser.id).eq("flight_number", flightNumber).eq("travel_date", travelDate).eq("status", "active").maybeSingle()
      : { data: null, error: null };
    const now = new Date().toISOString();
    const [ownedEntitlements, giftedEntitlements] = await Promise.all([
      admin.from("songa_commerce_entitlements").select("id,product_id,metadata,ends_at").eq("purchaser_user_id", signedInUser.id).in("status", ["ACTIVE", "CLAIMED"]).lte("starts_at", now),
      admin.from("songa_commerce_entitlements").select("id,product_id,metadata,ends_at").eq("beneficiary_user_id", signedInUser.id).in("status", ["ACTIVE", "CLAIMED"]).lte("starts_at", now),
    ]);
    const commerceRows = [...(ownedEntitlements.data ?? []), ...(giftedEntitlements.data ?? [])]
      .filter((row) => !row.ends_at || new Date(row.ends_at).getTime() > Date.now());
    const commerceError = ownedEntitlements.error || giftedEntitlements.error;
    const hasGeneralPass = commerceRows.some((row) => ["songa-premium-30", "songa-premium-365", "songa-gift-watch"].includes(row.product_id));
    const hasFlightRescue = commerceRows.some((row) => {
      if (row.product_id !== "songa-trip-rescue") return false;
      const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
      return String(metadata.flightNumber ?? "").toUpperCase().replace(/\s+/g, "") === flightNumber && String(metadata.travelDate ?? "") === travelDate;
    });
    if (legacyResult.error || commerceError || (!legacyResult.data && !hasGeneralPass && !hasFlightRescue)) {
      return json({ error: "premium_entitlement_required", message: "No active Songa Premium or Trip Rescue entitlement was found for this account and journey." }, 403);
    }
    premium = true;
  }
  const instructions = [
    "You are Songa AI, a concise and careful travel companion built by Songa.",
    "Help travellers understand flight information and think through practical next steps.",
    "Use only the supplied flight context and information in the conversation. You do not have general live internet access. You may use Songa’s search_flight tool when a traveller asks about a specific flight; rely only on the returned provider data.",
    "Never invent a gate, terminal, boarding time, delay, cancellation, aircraft position, fare, booking, refund, compensation eligibility or provider update.",
    "When a detail is missing, say it is not available in the supplied data and recommend checking the airline or airport display.",
    "Do not claim to book, rebook, cancel, refund, contact an airline or submit a compensation claim.",
    "For compensation, explain that eligibility depends on itinerary, airline, jurisdiction and circumstances; refer users to the official airline or Songa's AirHelp referral link where appropriate.",
    "For payments, explain that paid Songa assistance is optional and must be purchased in the app; never request card details or passwords in chat.",
    "You may use get_commerce_catalogue to discover exact Songa products and server-defined prices. Recommend only a product that fits the traveller's stated need. Direct the traveller to Travel Services to review and approve checkout. Never claim a purchase has started, never create or capture a payment in chat, never invent discounts or prices, and never imply a prepaid pass auto-renews.",
    "Use plain, warm, practical language. Start with the most important answer. Keep standard replies concise and use bullets only when helpful.",
    travellerPersonalisation ? `Traveller preferences supplied by the signed-in user. Use them to tailor examples and recommendations without making assumptions: ${travellerPersonalisation}` : "No saved traveller preferences are available. Do not assume a home airport, currency or travel interests.",
    premium ? "This traveller has purchased Songa Premium Travel Assistance for the selected flight. Provide a more detailed, structured disruption assessment, an ordered next-step plan and a short traveller checklist. Clearly distinguish provider-reported facts from suggestions. Never make bookings or promise availability." : "This is the standard Songa AI experience. Do not claim the user has purchased Premium Travel Assistance.",
    flight ? `Provider-backed flight context supplied by Songa (treat fields as provider-reported, not guaranteed): ${JSON.stringify(flight)}` : candidateFlight ? "Only demonstration/sample flight data is attached. Do not present it as current or factual. Use search_flight if the traveller asks for current flight information." : "No verified flight context is attached. Ask for a flight number or route if needed.",
  ].join("\n");

  const tools = [{
    type: "function",
    name: "search_flight",
    description: "Search Songa's connected flight data provider for a flight number and optional travel date. Use this when the traveller asks for current flight status, delay, cancellation, route or schedule information and no matching live flight context is already supplied.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        flightNumber: { type: "string", description: "Airline flight number such as KQ100 or EK720." },
        travelDate: { type: "string", description: "Travel date in YYYY-MM-DD format, or an empty string if the traveller did not supply one." },
      },
      required: ["flightNumber", "travelDate"],
      additionalProperties: false,
    },
  }, {
    type: "function",
    name: "get_commerce_catalogue",
    description: "Retrieve the current Songa server-defined commerce products, prices, durations and the clearly labelled NBO Airside Sandbox menu. Use this before recommending a paid Songa service or quoting a price.",
    strict: true,
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  }];

  try {
    const transcript: AgentTurn[] = messages.map((message) => ({ role: message.role, content: message.content }));
    let provider: "groq" | "gemini" = GROQ_API_KEY ? "groq" : "gemini";
    let response = await requestWithFallback(provider, transcript, instructions, tools, premium);
    provider = response.provider;
    let toolRounds = 0;
    while (toolRounds < 3 && response.toolCalls.length > 0) {
      const toolResults: Array<{ id: string; name: string; result: Record<string, unknown> }> = [];
      for (const call of response.toolCalls.slice(0, 2)) {
        let result: Record<string, unknown>;
        if (call.name === "search_flight") {
          let args: { flightNumber?: string; travelDate?: string | null } = {};
          try { args = JSON.parse(call.arguments || "{}"); } catch { args = {}; }
          result = await searchFlight(args.flightNumber ?? "", args.travelDate || null);
        } else if (call.name === "get_commerce_catalogue") {
          result = {
            currency: "USD",
            products: Object.entries(PRODUCT_CATALOG).map(([id, product]) => ({ id, ...product })),
            airside: {
              airport: "NBO / JKIA",
              mode: "SANDBOX DEMO — not a live airport merchant or fulfilment partnership",
              items: Object.entries(AIRSIDE_MENU).map(([sku, item]) => ({ sku, ...item })),
            },
            checkout: "The traveller must open Travel Services and explicitly approve PayPal checkout. No order or payment was created by this catalogue lookup.",
          };
        } else {
          result = { error: "unsupported_tool", message: "This Songa tool is not available." };
        }
        toolResults.push({ id: call.id, name: call.name, result });
      }
      transcript.push({ role: "assistant", content: response.text, toolCalls: response.toolCalls, providerContent: response.providerContent });
      transcript.push({ role: "tool", toolResults });
      response = await requestWithFallback(provider, transcript, instructions, tools, premium);
      provider = response.provider;
      toolRounds += 1;
    }
    if (!response.text) return json({ error: "empty_response", message: "Songa AI did not return a response. Please try again." }, 502);
    return json({ reply: response.text, model: response.model, provider: response.provider, fallbackUsed: response.provider === "gemini" && !!GROQ_API_KEY });
  } catch (error) {
    console.error("Songa AI request failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "ai_unavailable", message: "Songa AI could not complete that response. Please try again." }, 502);
  }
});

type AgentToolCall = { id: string; name: string; arguments: string };
type AgentTurn = {
  role: "user" | "assistant" | "tool";
  content?: string;
  toolCalls?: AgentToolCall[];
  toolResults?: Array<{ id: string; name: string; result: Record<string, unknown> }>;
  providerContent?: Record<string, unknown>;
};
type AgentResult = { text: string; toolCalls: AgentToolCall[]; provider: "groq" | "gemini"; model: string; providerContent?: Record<string, unknown> };

async function requestWithFallback(
  preferred: "groq" | "gemini",
  transcript: AgentTurn[],
  instructions: string,
  tools: Array<Record<string, unknown>>,
  premium: boolean,
): Promise<AgentResult> {
  const providers: Array<"groq" | "gemini"> = preferred === "groq"
    ? ["groq", ...(GEMINI_API_KEY ? ["gemini" as const] : [])]
    : ["gemini", ...(GROQ_API_KEY ? ["groq" as const] : [])];
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return provider === "groq"
        ? await callGroq(transcript, instructions, tools, premium)
        : await callGemini(transcript, instructions, tools, premium);
    } catch (error) {
      lastError = error;
      console.warn(`Songa AI provider ${provider} failed; ${providers.length > 1 ? "trying configured fallback" : "no fallback configured"}.`, error instanceof Error ? error.message : "unknown error");
    }
  }
  throw lastError ?? new Error("No AI provider is configured");
}

async function callGroq(
  transcript: AgentTurn[], instructions: string, tools: Array<Record<string, unknown>>, premium: boolean,
): Promise<AgentResult> {
  if (!GROQ_API_KEY) throw new Error("Groq is not configured");
  const messages: Array<Record<string, unknown>> = [{ role: "system", content: instructions }];
  for (const turn of transcript) {
    if (turn.role === "tool") {
      for (const result of turn.toolResults ?? []) messages.push({ role: "tool", tool_call_id: result.id, content: JSON.stringify(result.result) });
    } else if (turn.role === "assistant" && turn.toolCalls?.length) {
      messages.push({ role: "assistant", content: turn.content || null, tool_calls: turn.toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.arguments } })) });
    } else {
      messages.push({ role: turn.role, content: turn.content ?? "" });
    }
  }
  const chatTools = tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters, strict: tool.strict ?? true },
  }));
  const result = await fetchJson("https://api.groq.com/openai/v1/chat/completions", GROQ_API_KEY, {
    model: GROQ_MODEL, messages, tools: chatTools, tool_choice: "auto", parallel_tool_calls: false,
    max_completion_tokens: premium ? 950 : 550, temperature: 0.3,
  });
  const choice = (result.choices as Array<Record<string, unknown>> | undefined)?.[0];
  const message = choice?.message as Record<string, unknown> | undefined;
  const toolCalls = Array.isArray(message?.tool_calls) ? (message!.tool_calls as Array<Record<string, unknown>>).map((item) => {
    const fn = item.function as Record<string, unknown> | undefined;
    return { id: String(item.id ?? crypto.randomUUID()), name: String(fn?.name ?? ""), arguments: String(fn?.arguments ?? "{}") };
  }).filter((item) => item.name) : [];
  return { text: typeof message?.content === "string" ? message.content : "", toolCalls, provider: "groq", model: GROQ_MODEL };
}

async function callGemini(
  transcript: AgentTurn[], instructions: string, tools: Array<Record<string, unknown>>, premium: boolean,
): Promise<AgentResult> {
  if (!GEMINI_API_KEY) throw new Error("Gemini is not configured");
  const contents: Array<Record<string, unknown>> = [];
  for (const turn of transcript) {
    if (turn.role === "tool") {
      contents.push({ role: "user", parts: (turn.toolResults ?? []).map((item) => ({ functionResponse: { name: item.name, response: item.result } })) });
    } else if (turn.role === "assistant" && turn.providerContent) {
      // Preserve the provider's exact model turn, including Gemini thought signatures required for tool continuations.
      contents.push(turn.providerContent);
    } else if (turn.role === "assistant" && turn.toolCalls?.length) {
      contents.push({ role: "model", parts: turn.toolCalls.map((call) => ({ functionCall: { name: call.name, args: safeJsonObject(call.arguments) } })) });
    } else {
      contents.push({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.content ?? "" }] });
    }
  }
  const declarations = tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: geminiSchema(tool.parameters as Record<string, unknown>) }));
  const result = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, GEMINI_API_KEY, {
    systemInstruction: { parts: [{ text: instructions }] }, contents,
    tools: [{ functionDeclarations: declarations }], toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: { maxOutputTokens: premium ? 950 : 550, temperature: 0.3 },
  }, "x-goog-api-key");
  const candidate = (result.candidates as Array<Record<string, unknown>> | undefined)?.[0];
  const content = candidate?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content!.parts as Array<Record<string, unknown>> : [];
  const text = parts.filter((part) => typeof part.text === "string").map((part) => String(part.text)).join("\n").trim();
  const toolCalls = parts.filter((part) => part.functionCall && typeof part.functionCall === "object").map((part) => {
    const fn = part.functionCall as Record<string, unknown>;
    return { id: crypto.randomUUID(), name: String(fn.name ?? ""), arguments: JSON.stringify(fn.args ?? {}) };
  }).filter((item) => item.name);
  return { text, toolCalls, provider: "gemini", model: GEMINI_MODEL, providerContent: content };
}

async function fetchJson(url: string, apiKey: string, payload: Record<string, unknown>, authHeader = "Authorization"): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers[authHeader] = authHeader === "Authorization" ? `Bearer ${apiKey}` : apiKey;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(25_000) });
  const result = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !result) {
    const detail = result?.error && typeof result.error === "object" ? (result.error as Record<string, unknown>).message : undefined;
    console.error("Songa AI provider API error", response.status, detail ?? "unknown");
    throw new Error(`provider_http_${response.status}`);
  }
  return result;
}

function safeJsonObject(value: string): Record<string, unknown> {
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}

function geminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties && typeof schema.properties === "object" ? schema.properties as Record<string, Record<string, unknown>> : {};
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    const rawType = value.type;
    const type = Array.isArray(rawType) ? rawType.find((item) => item !== "null") : rawType;
    mapped[key] = { ...value, type: typeof type === "string" ? type.toUpperCase() : "STRING" };
    delete (mapped[key] as Record<string, unknown>).additionalProperties;
  }
  return { type: "OBJECT", properties: mapped, required: Array.isArray(schema.required) ? schema.required : [] };
}

async function searchFlight(flightNumber: string, travelDate: string | null): Promise<Record<string, unknown>> {
  const ident = flightNumber.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{2,10}$/.test(ident) || !/[A-Z]/.test(ident) || !/\d/.test(ident)) {
    return { error: "invalid_flight_number", message: "Please provide a valid airline flight number such as KQ100." };
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return { error: "not_configured", message: "The Songa flight search connection is not configured." };
  const response = await fetch(`${SUPABASE_URL}/functions/v1/flightaware`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ flightNumber: ident, ...(travelDate && /^\d{4}-\d{2}-\d{2}$/.test(travelDate) ? { travelDate } : {}) }),
    signal: AbortSignal.timeout(16_000),
  });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) return { error: "flight_provider_unavailable", status: response.status, message: payload?.message ?? "The provider could not return this flight." };
  return { source: payload?.source ?? "Songa connected flight provider", fetchedAt: payload?.fetchedAt ?? new Date().toISOString(), flights: Array.isArray(payload?.flights) ? payload.flights : [], note: "Only provider-returned fields are included; missing gate, terminal or timing fields must not be inferred." };
}


