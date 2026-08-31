import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { setAuthCookie } from "@/lib/auth";
import { evaluateRepublish } from "@/lib/republish-guard";
import { logRepublishDecision } from "@/lib/republish-audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  // Every dead end here is a real owner holding a link that stopped working. Carry the slug
  // so /claim/error can hand them a fresh one rather than only a "back to directory" link.
  const claimError = (s?: string | null) =>
    `${siteUrl}/claim/error${s ? `?slug=${encodeURIComponent(s)}` : ""}`;

  if (!token || !slug) {
    return NextResponse.redirect(claimError(slug));
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token, owner_auth_token_expires_at, submitted_via, submission_status, is_published, deserve_reason, name, npi")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    return NextResponse.redirect(claimError(slug));
  }

  if (listing.owner_auth_token_expires_at && new Date(listing.owner_auth_token_expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(claimError(slug));
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
  // evaluateRepublish fails CLOSED. Two separate authorities publish here and only
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
  //
  // Every guard decision — ALLOW *and* DENY — is written to empire_republish_decisions BEFORE
  // any flip, and the flip is gated on that write landing. A DENY is not a dead end for the
  // person: they are a verified owner, so they are routed to /claim/held/<slug>, which renders
  // their name behind the owner cookie ONLY.
  // ---------------------------------------------------------------------------
  // `true` when this claim verified ownership of a row the guard did NOT republish.
  // The claim still stands; the page stays hidden — so the owner is routed to the held
  // SIGNAL page rather than a silent /owner dashboard sitting over a 404.
  let heldAfterClaim = false;

  if (listing.submitted_via === "self_serve" && listing.submission_status === "pending_verification") {
    update.is_published = true;
    update.submission_status = "verified";
  } else if (listing.is_published === false) {
    // The guard runs ONLY for a held row. An already-published claim skips this block
    // entirely — no adjudication, no audit row — exactly as before.
    const guardInput = {
      is_published: listing.is_published,
      deserve_reason: listing.deserve_reason,
      name: listing.name,
      npi: listing.npi,
      submitted_via: listing.submitted_via,
    };
    const decision = evaluateRepublish(guardInput);

    // AUDIT BEFORE FLIP, and the flip is gated on the audit landing. An unlogged flip is
    // unreconstructable, so a failed audit insert is treated as DENY (fail-closed) rather
    // than as a technicality to publish through.
    const auditLogged = await logRepublishDecision({
      listing_id: listing.id,
      listing_slug: slug,
      input: guardInput,
      decision,
    });

    if (decision.allow && auditLogged) {
      update.is_published = true;
      update.deserve_reason = null;
      update.deserved_at = null;
    } else {
      heldAfterClaim = true;
    }
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
    return NextResponse.redirect(claimError(slug));
  }
  if ((count ?? 0) === 0) {
    console.error(`[claim/verify] claim write matched 0 rows for ${slug} (id=${listing.id})`);
    return NextResponse.redirect(claimError(slug));
  }

  // The claim is recorded but the listing is still hidden (DENY, or the audit did not land).
  // Route to the held SIGNAL page with the owner cookie set, NOT to /owner — the improvement
  // over a silent dashboard over a 404. No place-resolve/billing handoff fires for a row that
  // is not publicly visible.
  //
  // NOTE the reference (webdesigner f217317) also routes here on a FAILED FLIP, because there
  // the claim is an RPC and the flip is a second UPDATE, so a failed flip leaves claimed=true
  // with the row still down. Here the claim and the flip are ONE atomic UPDATE: if it fails,
  // nothing was written at all, and the checks above already redirect to /claim/error with the
  // magic link still valid for an idempotent retry. The half-written state that case exists to
  // catch cannot occur on this path.
  if (heldAfterClaim) {
    const heldResp = NextResponse.redirect(`${siteUrl}/claim/held/${slug}`);
    setAuthCookie(heldResp, token, slug);
    return heldResp;
  }

  const response = NextResponse.redirect(`${siteUrl}/owner/${slug}`);
  setAuthCookie(response, token, slug);
  return response;
}
