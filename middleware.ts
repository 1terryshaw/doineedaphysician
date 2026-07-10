// TDL #684 AEO v2 — AI bot crawler tracking (shared, BYTE-IDENTICAL across repos).
//
// Detects AEO / AI-assistant crawlers by User-Agent and fire-and-forget logs the
// hit to Supabase via the log_ai_crawler_hit_v2() RPC (anon key + SECURITY DEFINER
// function — no service-role key at the edge, anon cannot read the table).
//
// v2 vs v1: same detection/dedup/allow-list, but ALSO captures user_agent and
// source_ip (req.ip on Vercel). Verification (bot_verified) is left NULL for an
// async backfill. source_ip is format-validated here so a malformed value can
// NEVER reach the RPC's ::inet cast (which would log an rpc_exception and gate
// the pilot status RED).
//
// ZERO added user latency: the network write runs inside event.waitUntil() and is
// never awaited on the response path. Non-bot requests do a single regex test and
// fall straight through to NextResponse.next().
//
// SHARED-FILE NOTES (AEO v2 Wave 1):
//   - This file is COPY-PASTE IDENTICAL across repos (md5-verified). vertical_slug
//     is read from lib/vertical.config.ts (registrySlug), so no per-repo edit here.
//   - To add a new bot, add a row to AI_BOTS *and* the SQL allow-list (keep synced).
//   - Requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in env.

import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import verticalConfig from "@/lib/vertical.config";

// Canonical UA token → canonical bot_name. Order: most specific first.
// Case-insensitive. MUST stay in sync with the SQL allow-list.
const AI_BOTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/GPTBot/i, "GPTBot"],
  [/ChatGPT-User/i, "ChatGPT-User"],
  [/ClaudeBot/i, "ClaudeBot"],
  [/anthropic-ai/i, "anthropic-ai"],
  [/PerplexityBot/i, "PerplexityBot"],
  [/Perplexity-User/i, "Perplexity-User"],
  // NB: Google-Extended is NOT a crawler — it's a robots.txt control token that
  // makes zero HTTP requests, so it would never fire here. The Google UAs that
  // actually crawl are user-triggered Gemini agents:
  [/Google-Agent/i, "Google-Agent"],
  [/Gemini-Deep-Research/i, "Gemini-Deep-Research"],
  [/Applebot-Extended/i, "Applebot-Extended"],
  [/Amazonbot/i, "Amazonbot"],
  [/Bytespider/i, "Bytespider"],
  [/Meta-ExternalAgent/i, "Meta-ExternalAgent"],
  [/CCBot/i, "CCBot"],
  [/YouBot/i, "YouBot"],
  [/cohere-ai/i, "cohere-ai"],
];

function detectBot(ua: string | null): string | null {
  if (!ua) return null;
  for (const [re, name] of AI_BOTS) {
    if (re.test(ua)) return name;
  }
  return null;
}

// Return a syntactically-valid IPv4/IPv6 string, or null. Guarantees the RPC's
// ::inet cast cannot throw (which would log an rpc_exception → RED gate).
function clientIp(req: NextRequest): string | null {
  const raw =
    req.ip ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  if (!raw) return null;
  const ipv4 =
    /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
  const ipv6 = /^(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv4.test(raw) || ipv6.test(raw) ? raw : null;
}

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const ua = req.headers.get("user-agent");
  const bot = detectBot(ua);
  if (bot) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anon) {
      const body = JSON.stringify({
        p_bot_name: bot,
        p_vertical_slug: verticalConfig.registrySlug,
        p_path: req.nextUrl.pathname,
        // Edge-derived country code only. Undefined locally.
        p_country_inferred: req.geo?.country ?? null,
        // Final render status is unknown at middleware time (no log drains).
        p_status_code: null,
        p_user_agent: ua,
        p_source_ip: clientIp(req),
      });
      event.waitUntil(
        fetch(`${url}/rest/v1/rpc/log_ai_crawler_hit_v2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anon,
            Authorization: `Bearer ${anon}`,
          },
          body,
          // never let logging interfere with anything; swallow all errors
          keepalive: true,
        }).catch(() => {}),
      );
    }
  }
  return NextResponse.next();
}

export const config = {
  // Track content pages + sitemap/robots (real crawler signal); skip Next
  // internals, static assets, and API routes (no AEO value, keeps middleware
  // off the hot path).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
