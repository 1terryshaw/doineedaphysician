// RETIRE-CANDIDATE (TDL #455): not form-wired as of 2026-06-01 (the InquiryForm posts to
// /api/forward-lead). Hardened with the shared guard for safety; remove pending traffic-log
// confirmation that nothing posts here.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE, INQUIRIES_TABLE } from "@/lib/supabase";
import { sendInquiryNotification } from "@/lib/email";
import {
  shouldSilentDrop,
  isValidEmail,
  looksLikeBotContent,
  effectiveForwardEmail,
} from "@/lib/inquiry-guard";

const ADMIN_EMAIL = "terry@doineedapro.com";

export async function POST(request: NextRequest) {
  const { listingSlug, name, email, phone, message, honeypot, renderedAt } =
    await request.json();

  // Silent drop — honeypot / sub-2.5s only.
  if (shouldSilentDrop({ honeypot, renderedAt })) {
    return NextResponse.json({ success: true });
  }

  if (!listingSlug || !name || !email || !message) {
    return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
  }

  // Malformed/junk submitter email -> 400 (human-correctable).
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, name, owner_email, email")
    .eq("slug", listingSlug)
    .single();

  if (error || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Disposition (BEFORE any forward).
  const fwdEmail = effectiveForwardEmail(listing);
  const isBot = looksLikeBotContent({ name, message, email });
  const status = isBot ? "spam_review" : fwdEmail ? "new" : "needs_bridging";

  // Always store one disposition row (D1).
  const { data: inquiry } = await supabaseAdmin
    .from(INQUIRIES_TABLE)
    .insert({
      listing_id: listing.id,
      name,
      email,
      phone: phone || null,
      message,
      status,
    })
    .select("reply_token")
    .single();

  if (status === "spam_review") {
    return NextResponse.json({ success: true, forwarded: false });
  }

  if (status === "needs_bridging") {
    return NextResponse.json({ success: true, forwarded: false });
  }

  // status === "new": forward to the validated address only.
  await sendInquiryNotification(fwdEmail!, listing.name, {
    name,
    email,
    phone,
    message,
    replyToken: inquiry?.reply_token,
  }, listingSlug);

  return NextResponse.json({ success: true, forwarded: true });
}
