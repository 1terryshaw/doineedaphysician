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
  await supabaseAdmin.from(LISTINGS_TABLE).update(update).eq("id", listing.id);

  const response = NextResponse.redirect(`${siteUrl}/owner/${slug}`);
  setAuthCookie(response, token, slug);
  return response;
}
