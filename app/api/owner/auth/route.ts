import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { setAuthCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!token || !slug) {
    return NextResponse.redirect(`${siteUrl}/owner/login?error=invalid`);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    return NextResponse.redirect(`${siteUrl}/owner/login?error=invalid`);
  }

  // Stamp owner activity (Phase 3 ranking signal)
  // TDL #1047 — K36 un-swallow, deliberately NOT fail-closed. This write is TELEMETRY, not the
  // auth: authentication is the token compare above plus the cookie below. Failing the request
  // when the activity stamp fails would break owner LOGIN on any DB blip — strictly worse than
  // the bug. Check the error, log it loudly, let the owner in.
  const { error: stampErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ owner_last_action_at: new Date().toISOString() })
    .eq("id", listing.id);

  if (stampErr) {
    console.error(
      `[owner/auth] owner_last_action_at stamp failed for ${slug} (login NOT blocked): ${stampErr.message}`
    );
  }

  const response = NextResponse.redirect(`${siteUrl}/owner/${slug}`);
  setAuthCookie(response, token, slug);
  return response;
}
