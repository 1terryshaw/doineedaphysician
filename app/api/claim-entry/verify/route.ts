/**
 * POST /api/claim-entry/verify — possession verification.
 *
 * CANONICAL FILE. Copied byte-for-byte into each vertical repo. Do not edit per-repo copies.
 *
 * Consumes a one-time challenge code against a private intent.  A SUCCESSFUL verification
 * publishes NOTHING — it only advances the intent to `verified`.  Publication is a
 * separate call that the republish guard alone can authorise.
 *
 * Constant-time comparison, ≤5 attempts, 15-minute expiry, single use, target-bound.
 * Externally uniform: a wrong code, an expired intent, an unknown intent and a locked
 * intent are indistinguishable.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  GENERIC_BODY, LIMITS, challengeDigest, checkRequest, flags, parseBody, safeEqualHex, timingFloor,
} from "@/lib/claim-entry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function generic(verified: boolean): NextResponse {
  // `verified` is the ONE bit this endpoint may reveal, and only to a caller who already
  // holds a valid intent id AND a valid code — i.e. who already proved possession. It
  // discloses nothing about the corpus.
  return NextResponse.json(verified ? { ...GENERIC_BODY, status: "verified" } : GENERIC_BODY, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const f = flags();
  if (!f.enabled) return new NextResponse(null, { status: 404 });

  try {
    const check = checkRequest(request, request.cookies.get("claim_entry_csrf")?.value);
    if (!check.ok) {
      await timingFloor(startedAt, f.minResponseMs);
      return generic(false);
    }

    const body = parseBody(await request.text(), ["intentId", "code"]);
    if (!body?.intentId || !body?.code) {
      await timingFloor(startedAt, f.minResponseMs);
      return generic(false);
    }

    const { data: intent } = await supabaseAdmin
      .from("medical_claim_intents")
      .select("id, status, attempts, token_hash, token_salt, expires_at, listing_table, listing_id")
      .eq("id", body.intentId)
      .maybeSingle();

    if (!intent) {
      await timingFloor(startedAt, f.minResponseMs);
      return generic(false);
    }

    // Single use: only a dispatched intent may be verified. `verified` and `finalized`
    // are terminal, so a replayed code cannot re-run the flow.
    const consumable = intent.status === "dispatched";
    const expired = new Date(intent.expires_at).getTime() < Date.now();
    const overAttempts = (intent.attempts ?? 0) >= LIMITS.attemptsPerIntent;

    if (!consumable || expired || overAttempts || !intent.token_hash || !intent.token_salt) {
      if (expired && consumable) {
        await supabaseAdmin.from("medical_claim_intents")
          .update({ status: "expired" }).eq("id", intent.id).eq("status", "dispatched");
      }
      await timingFloor(startedAt, f.minResponseMs);
      return generic(false);
    }

    const ok = safeEqualHex(challengeDigest(body.code, intent.token_salt), intent.token_hash);

    if (!ok) {
      const attempts = (intent.attempts ?? 0) + 1;
      await supabaseAdmin.from("medical_claim_intents").update({
        attempts,
        status: attempts >= LIMITS.attemptsPerIntent ? "locked" : "dispatched",
      }).eq("id", intent.id);
      await timingFloor(startedAt, f.minResponseMs);
      return generic(false);
    }

    // Conditional update on the CURRENT status: two concurrent callbacks cannot both win,
    // so a race cannot produce two verified intents (and therefore not two claims).
    const { count } = await supabaseAdmin
      .from("medical_claim_intents")
      .update({ status: "verified", verified_at: new Date().toISOString(),
                token_hash: null, token_salt: null }, { count: "exact" })
      .eq("id", intent.id)
      .eq("status", "dispatched");

    await timingFloor(startedAt, f.minResponseMs);
    return generic(count === 1);
  } catch (err) {
    console.error("claim-entry verify error:", err instanceof Error ? err.message : "unknown");
    await timingFloor(startedAt, f.minResponseMs);
    return generic(false);
  }
}
