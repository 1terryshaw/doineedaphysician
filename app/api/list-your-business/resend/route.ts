import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { generateToken } from "@/lib/auth";
import { sendAddBusinessEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let slug = "";
  try { ({ slug } = await req.json()); } catch { return NextResponse.json({ success: true }); }
  if (!slug) return NextResponse.json({ success: true });

  const { data: listing } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, slug, owner_email, business_name, submitted_via, submission_status, claimed")
    .eq("slug", slug)
    .single();

  if (!listing || listing.submitted_via !== "self_serve" || listing.submission_status !== "pending_verification" || listing.claimed || !listing.owner_email) {
    return NextResponse.json({ success: true });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin.from(LISTINGS_TABLE).update({ owner_auth_token: token, owner_auth_token_expires_at: expiresAt }).eq("id", listing.id);

  const sent = await sendAddBusinessEmail(listing.owner_email, listing.slug, token, listing.business_name || "");
  if (!sent.ok) {
    return NextResponse.json({ error: "Could not send the email. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
