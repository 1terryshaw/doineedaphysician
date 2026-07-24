/**
 * POST /api/claim-entry/finalize — the ONLY publication path in this funnel.
 *
 * CANONICAL FILE. Copied byte-for-byte into each vertical repo. Do not edit per-repo copies.
 *
 * Requires a VERIFIED intent.  Invokes the canonical republish guard and writes exactly
 * the same terminal shape `/api/claim/verify` already writes.  The guard is the sole
 * authority on `is_published`: if it denies, the claim is still recorded and the row
 * STAYS non-public.
 *
 * Provenance is never rewritten — submitted_via, source, submitted_at and npi are not in
 * any update this route can emit, so a claimed row is never made to look owner-submitted.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { setAuthCookie, generateToken } from "@/lib/auth";
import { evaluateRepublish } from "@/lib/republish-guard";
import { GENERIC_BODY, checkRequest, flags, parseBody, timingFloor } from "@/lib/claim-entry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function generic(extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ...GENERIC_BODY, ...extra }, {
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
      return generic();
    }

    const body = parseBody(await request.text(), ["intentId"]);
    if (!body?.intentId) {
      await timingFloor(startedAt, f.minResponseMs);
      return generic();
    }

    // Two independent locks. Either one closed means nothing can publish.
    if (!f.finalizeEnabled || !f.guardEnabled) {
      await timingFloor(startedAt, f.minResponseMs);
      return generic();
    }

    const { data: intent } = await supabaseAdmin
      .from("medical_claim_intents")
      .select("id, status, listing_table, listing_id, verified_at")
      .eq("id", body.intentId)
      .maybeSingle();

    // ONLY a verified intent may finalize. `finalized` is terminal, so a retry is a no-op
    // rather than a second claim.
    if (!intent || intent.status !== "verified" || !intent.listing_id
        || intent.listing_table !== LISTINGS_TABLE) {
      await timingFloor(startedAt, f.minResponseMs);
      return generic();
    }

    const { data: listing } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("id, slug, name, npi, is_published, deserve_reason, submitted_via, claimed")
      .eq("id", intent.listing_id)
      .maybeSingle();

    if (!listing || listing.claimed) {
      await timingFloor(startedAt, f.minResponseMs);
      return generic();
    }

    // ── THE GUARD. Nothing else in this file may open is_published. ──────────────
    const decision = evaluateRepublish({
      is_published: listing.is_published,
      deserve_reason: listing.deserve_reason,
      name: listing.name,
      npi: listing.npi,
      submitted_via: listing.submitted_via,
    });

    const now = new Date().toISOString();
    const token = generateToken();
    const update: Record<string, unknown> = {
      claimed: true, claimed_at: now, updated_at: now,
      owner_auth_token: token,
      owner_auth_token_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    };
    if (decision.allow) {
      update.is_published = true;
      update.deserve_reason = null;
      update.deserved_at = null;
    }

    // Fail closed: pinned to the row AND to it still being unclaimed, count exact.
    const { error, count } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .update(update, { count: "exact" })
      .eq("id", listing.id)
      .neq("claimed", true);

    if (error || count !== 1) {
      await supabaseAdmin.from("medical_claim_intents").update({
        guard_decision: decision.allow, guard_reason_code: decision.reason_code,
        status: "failed",
      }).eq("id", intent.id).eq("status", "verified");
      await timingFloor(startedAt, f.minResponseMs);
      return generic();
    }

    await supabaseAdmin.from("medical_claim_intents").update({
      status: "finalized", finalized_at: now,
      guard_decision: decision.allow, guard_reason_code: decision.reason_code,
    }).eq("id", intent.id).eq("status", "verified");

    await timingFloor(startedAt, f.minResponseMs);
    const res = generic({ status: "claimed", next: `/owner/${listing.slug}` });
    setAuthCookie(res, token, listing.slug);
    return res;
  } catch (err) {
    console.error("claim-entry finalize error:", err instanceof Error ? err.message : "unknown");
    await timingFloor(startedAt, f.minResponseMs);
    return generic();
  }
}
