import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { setAuthCookie } from "@/lib/auth";

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
    .select("id, owner_auth_token, owner_auth_token_expires_at, submitted_via, submission_status")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }

  // Mark as claimed (+ self-serve publish flip) — TDL #655
  if (listing.owner_auth_token_expires_at && new Date(listing.owner_auth_token_expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }
  if (listing.owner_auth_token_expires_at && new Date(listing.owner_auth_token_expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(`${siteUrl}/claim/error`);
  }
  const update: Record<string, unknown> = { claimed_at: new Date().toISOString(), claimed: true, updated_at: new Date().toISOString() };
  if (listing.submitted_via === "self_serve" && listing.submission_status === "pending_verification") {
    update.is_published = true;
    update.submission_status = "verified";
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
