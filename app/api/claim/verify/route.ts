import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { setAuthCookie } from "@/lib/auth";
import { canRepublishOnClaim } from "@/lib/republish-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!token || !slug) {
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token, owner_auth_token_expires_at, submitted_via, submission_status, is_published, deserve_reason, name, npi")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }

  if (listing.owner_auth_token_expires_at && new Date(listing.owner_auth_token_expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { claimed_at: now, claimed: true, updated_at: now };

  // ---------------------------------------------------------------------------
  // TWO INDEPENDENT publish paths. They are deliberately kept separate: this
  // vertical has BOTH a self-serve funnel and a de-served seeded inventory, and
  // the canonical guard governs only the second.
  //
  // Path 1 — TDL #655 self-serve publish flip. An owner who submitted their OWN
  // listing publishes it by verifying their email. These rows are never seeded and
  // never carry a deserve_reason, so the guard below does not (and must not) reach
  // them. Preserved verbatim: the canonical guarded reference (doineedhvac) DROPPED
  // this branch because the trades repos have no self-serve funnel — porting that
  // file byte-for-byte here would silently break self-serve signup.
  //
  // Path 2 — TDL #1068 republish-on-claim. An email-verified claim is consent from
  // the listing's subject, so a de-served SEEDED person row republishes here.
  // canRepublishOnClaim fails CLOSED. Two separate authorities publish here and only
  // these two: person_seeded_licensing_roster (K38 consent, ruling 2026-07-18) and
  // nppes_type2_org_claim_then_publish (organization owner control, ruling 2026-07-22 —
  // which additionally requires npi present AND submitted_via='seeded', so the org lane
  // can never be reached by an impersonated self-serve row). RESTRICTED-source rows stay
  // down (consent cures K38, never a SOURCE licence bar — #1014), as do NULL/unrecognised
  // reasons and nameless rows.
  //
  // `npi` MUST stay in the SELECT above: the org lane reads it, and an absent column is an
  // undefined field, which the guard treats as DENY_org_lane_missing_npi — silently and
  // permanently refusing every organization claim.
  // ---------------------------------------------------------------------------
  if (listing.submitted_via === "self_serve" && listing.submission_status === "pending_verification") {
    update.is_published = true;
    update.submission_status = "verified";
  } else if (canRepublishOnClaim(listing)) {
    update.is_published = true;
    update.deserve_reason = null;
    update.deserved_at = null;
  }

  // TDL #1047 — K36. supabase-js RETURNS { error }; it does not throw, and an UPDATE matching
  // ZERO rows returns no error at all. This write was awaited unchecked and the auth cookie was
  // then set and the user redirected to the owner dashboard REGARDLESS — a failed write left a
  // half-granted state: an owner session over a listing that was never marked claimed.
  // FAIL-CLOSED: no claim write, no session. The magic-link token stays valid and the update is
  // idempotent (PK-keyed, deterministic), so the user can simply click the link again.
  const { error: claimErr, count } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update(update, { count: "exact" })
    .eq("id", listing.id);

  if (claimErr) {
    console.error(`[claim/verify] claim write FAILED for ${slug}: ${claimErr.message}`);
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }
  if ((count ?? 0) === 0) {
    console.error(`[claim/verify] claim write matched 0 rows for ${slug} (id=${listing.id})`);
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }

  const response = NextResponse.redirect(`${siteUrl}/owner/${slug}`);
  setAuthCookie(response, token, slug);
  return response;
}
