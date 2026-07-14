// TDL #1019 — Wave 3 instrumentation. Shared event-logging helper.
//
// DESIGN RULES (TDL #1014, approved):
//  1. VERTICAL is a STAMPED CONSTANT, resolved at sweep time from the `empire_verticals` registry
//     (authoritative: matched on primary_domain). It is NOT inferred at runtime and NOT read from
//     the request body. `analytics.events.vertical` is NOT NULL, so a route that loses its vertical
//     cannot insert at all. This is what makes the #1012 bug (`vertical_category: null`, a hardcoded
//     literal) structurally impossible rather than merely discouraged.
//
//     Do NOT "simplify" this to tablePrefix: cleaningservice's tablePrefix is `cleaning_` but its
//     registry vertical_slug is `cleaningservice`. Deriving from tablePrefix writes a vertical that
//     joins to nothing.
//
//  2. client_class is populated AT WRITE from the UA. Bots are LOGGED — ChatGPT-User probed us 32x
//     in one month, which is product intelligence — but they are EXCLUDED from the match-rate
//     denominator by analytics.v_match_rate. 47 of the first 121 conversations were AI crawlers; if
//     they enter the denominator every number we quote is wrong.
//
//  3. FAIL-OPEN. Never throws. Call AFTER the user-facing response is produced, so a logging
//     failure or slow write can never break or delay the product.
//
//  4. The raw IP is never stored — only a salted hash, for abuse detection.

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// ── stamped at sweep time from empire_verticals ───────────────────────────────
const VERTICAL = "physicians";
const MARKET   = "unknown";
const PROPERTY = "doineedaphysician.com";

// Same list the fleet's bot firewall already uses — reused, not reinvented.
const AI_BOT_UA =
  /ChatGPT-User|GPTBot|OAI-SearchBot|ClaudeBot|anthropic-ai|claude-web|PerplexityBot|Perplexity-User|Google-Extended|GoogleOther|CCBot|Bytespider|Amazonbot|Applebot-Extended|Meta-ExternalAgent|FacebookBot|cohere-ai|Diffbot|omgili|ImagesiftBot|YouBot|DuckAssistBot|PetalBot|Timpibot|bot|crawler|spider/i;
const SELF_TEST_UA = /curl|wget|python-requests|node-fetch|insomnia|postman|smoke/i;

export type Surface = "chat" | "quiz" | "calculator" | "directory";
export type EventType =
  | "started" | "question_asked" | "answered" | "completed"
  | "listing_clicked" | "listing_selected" | "abandoned" | "error";
export type ClientClass = "human_browser" | "ai_crawler" | "own_test" | "unknown";

export function classifyClient(ua: string | null | undefined): ClientClass {
  if (!ua) return "unknown";
  if (AI_BOT_UA.test(ua)) return "ai_crawler";
  if (SELF_TEST_UA.test(ua)) return "own_test";
  if (/Mozilla|AppleWebKit|Gecko|Chrome|Safari|Firefox|Edge/i.test(ua)) return "human_browser";
  return "unknown";
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.ANALYTICS_IP_SALT || "empire-wave3";
  return crypto.createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);
}

export interface EventInput {
  session_id: string;
  surface: Surface;
  event_type: EventType;
  // structured extractions — first-class columns, never buried in payload
  city?: string | null;
  region?: string | null;
  inferred_vertical?: string | null;
  intent?: string | null;
  urgency?: string | null;
  // the numerator
  outbound_url?: string | null;
  listing_slug?: string | null;
  turn_index?: number | null;
  payload?: Record<string, unknown>;
}

/** Emit one event. FAIL-OPEN — never throws, never blocks. Call AFTER the response is produced. */
export async function logEvent(
  input: EventInput,
  req?: { headers: Headers }
): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return; // unconfigured → silent no-op, never break the request

    const ua = req?.headers.get("user-agent") ?? null;
    const referrer = req?.headers.get("referer") ?? null;
    const ip =
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req?.headers.get("x-real-ip") ??
      null;

    // Market is per-REQUEST, not per-repo: a multimarket property serves its base market at the
    // root and the UK at /uk (TDL #824). Attributing every event to the stamped market would file
    // all UK traffic under the base market.
    const path = referrer || "";
    const market = /\/uk(\/|$|\?)/i.test(path) ? "UK" : MARKET;

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Write via a SECURITY DEFINER RPC in `public`, NOT `supabase.schema("analytics")`.
    // PostgREST only exposes `public` + `graphql_public`, so a direct schema("analytics") insert
    // fails with PGRST106 "Invalid schema". Routing through the RPC keeps the analytics schema
    // entirely OFF the public REST API (only service_role may EXECUTE) while still being writable.
    const { error } = await supabase.rpc("log_event", {
      p: {
        session_id: input.session_id,
        surface: input.surface,
        event_type: input.event_type,
        client_class: classifyClient(ua),

        vertical: VERTICAL,   // stamped — cannot be null, cannot be spoofed
        market,
        property: PROPERTY,

        city: input.city ?? null,
        region: input.region ?? null,
        inferred_vertical: input.inferred_vertical ?? null,
        intent: input.intent ?? null,
        urgency: input.urgency ?? null,

        outbound_url: input.outbound_url ?? null,
        listing_slug: input.listing_slug ?? null,
        turn_index: input.turn_index ?? null,
        payload: input.payload ?? {},

        user_agent: ua,
        referrer,
        ip_hash: hashIp(ip),
      },
    });

    // supabase-js RETURNS { error } — it does NOT throw. The first cut of this helper never
    // checked it, so a PGRST106 failure fell straight through the try{} and logged NOTHING:
    // 0 events landed while the collector still answered {ok:true}. That is the exact swallow
    // pattern TDL #990-#995 spent the week eradicating. Check the error. Still FAIL-OPEN
    // (we never throw at the caller) — but never SILENT.
    if (error) {
      console.error("[analytics] log_event RPC failed (non-fatal):", error.message ?? error);
    }
  } catch (err) {
    // FAIL-OPEN — a broken logger must never break the product.
    console.error("[analytics] logEvent failed (non-fatal):", err);
  }
}
