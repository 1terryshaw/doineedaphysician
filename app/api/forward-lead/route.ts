import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE, INQUIRIES_TABLE } from "@/lib/supabase";
import { sendInquiryNotification } from "@/lib/email";
import { sendLeadForwardEmail, sendInquiryConfirmation, sendClaimPitchForward } from "@/lib/resend";
import { sendLeadForwardSMS } from "@/lib/twilio";
import { can } from "@/lib/tier-capabilities";
import verticalConfig from "@/lib/vertical.config";
import {
  shouldSilentDrop,
  isValidEmail,
  looksLikeBotContent,
  effectiveForwardEmail,
} from "@/lib/inquiry-guard";
import { shouldPitch, claimUrl, CLAIM_PATH } from "@/lib/claim-pitch";
import { isSuppressed } from "@/lib/suppression";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VALID_URGENCY = ["emergency", "urgent", "flexible"] as const;
const ADMIN_EMAIL = "terry@doineedapro.com";

export async function POST(request: NextRequest) {
  let body: {
    listingSlug: string;
    name: string;
    email: string;
    phone?: string;
    message: string;
    serviceNeeded?: string;
    urgency?: string;
    honeypot?: string;
    renderedAt?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { listingSlug, name, email, phone, message, serviceNeeded, honeypot, renderedAt } = body;
  const urgency = VALID_URGENCY.includes(body.urgency as any)
    ? (body.urgency as string)
    : "flexible";

  // Silent drop — honeypot / sub-2.5s only. Return ok:true so bots learn nothing.
  if (shouldSilentDrop({ honeypot, renderedAt })) {
    return NextResponse.json({ success: true });
  }

  if (!listingSlug || !name || !email || !message) {
    return NextResponse.json(
      { error: "Required fields: listingSlug, name, email, message" },
      { status: 400 }
    );
  }

  // Malformed/junk submitter email -> 400 so a human typo is correctable (not silent-dropped).
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  // Look up listing
  const { data: listing, error: listingErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select(
      "id, name, owner_email, phone, email, tier, subscription_tier, claimed, last_claim_pitch_at, stripe_subscription_id"
    )
    .eq("slug", listingSlug)
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // ── Disposition (BEFORE the paid/free branch) ──────────────────────
  const fwdEmail = effectiveForwardEmail(listing); // validated owner_email -> scraped email -> null
  const isBot = looksLikeBotContent({ name, message, email });

  // TDL #510 P2.1: anti-abuse hard gate — multi-axis blocklist (email/IP/body-hash),
  // >5 inquiries/24h rate-limit, identical-body>10/24h. Allowlist consulted first.
  // Fail-open on RPC error: never drop a legitimate lead because the verdict check broke.
  let abuseQuarantine = false;
  try {
    // TDL #1047 — K36. supabase-js RETURNS { error }; it does not throw, so this try/catch
    // never fired on an RPC failure and a broken abuse gate was skipped with NO log at all.
    // Fail-open is deliberate here (never drop a legitimate lead), so this is a VISIBILITY
    // fix, not a policy change.
    const { data: verdict, error: verdictErr } = await supabaseAdmin.rpc("abuse_inquiry_verdict", {
      p_email: email,
      p_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      p_message: message,
    });
    if (verdictErr) {
      console.error("[abuse] inquiry verdict RPC failed (fail-open, gate SKIPPED):", verdictErr.message);
    }
    abuseQuarantine = !!(verdict && (verdict as { quarantine?: boolean }).quarantine);
  } catch (e) {
    console.error("[abuse] inquiry verdict failed (fail-open):", e instanceof Error ? e.message : e);
  }

  const status =
    abuseQuarantine || isBot ? "spam_review" : fwdEmail ? "new" : "needs_bridging";

  // Always store one disposition row (D1: *_inquiries is the ledger; nothing lost).
  // TDL #1047 — "nothing lost" was a LIE under failure. The error was never destructured, so a
  // failed insert let the route carry on: it forwarded the email and returned success while
  // the lead vanished from the ledger. FAIL-CLOSED (approved): no ledger row => no forward,
  // and an honest retryable error.
  const { data: inquiryRow, error: inquiryErr } = await supabaseAdmin
    .from(INQUIRIES_TABLE)
    .insert({
      listing_id: listing.id,
      name,
      email,
      phone: phone || null,
      message,
      status,
    })
    .select("id")
    .single();

  if (inquiryErr || !inquiryRow) {
    console.error(
      `[forward-lead] LEAD LEDGER WRITE FAILED for ${listingSlug}: ${inquiryErr?.message ?? "no row returned"} — lead NOT forwarded`
    );
    return NextResponse.json(
      { error: "We couldn't record your request just now. Please try again in a moment — nothing was sent." },
      { status: 500 }
    );
  }
  const inquiryId: string | null = inquiryRow.id ?? null;

  // Quarantined spam: stored, never forwarded, never notified.
  if (status === "spam_review") {
    return NextResponse.json({ success: true, forwarded: false });
  }

  // No deliverable address: surface to admin (manual-bridge queue), do not forward.
  if (status === "needs_bridging") {
    return NextResponse.json({ success: true, forwarded: false });
  }

  // status === "new": forward to the validated address only.
  const forwardTo = fwdEmail!;
  const tier = listing.tier || listing.subscription_tier || "free";
  const businessPhone = listing.phone;
  const listingId = `${verticalConfig.tablePrefix}listings:${listing.id}`;
  const visitorIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const visitorUserAgent = request.headers.get("user-agent") || null;

  // ── LEAD BOOST+ PATH: forward via Resend + Twilio ──────────────────
  if (can(tier, "lead_forwarding")) {
    const [emailResult, smsResult] = await Promise.allSettled([
      sendLeadForwardEmail({
        businessName: listing.name,
        businessEmail: forwardTo,
        visitorName: name,
        visitorEmail: email,
        visitorPhone: phone,
        message,
        serviceNeeded,
        urgency,
      }),
      businessPhone
        ? sendLeadForwardSMS(businessPhone, name, listing.name)
        : Promise.resolve({ success: false, error: "no_phone" }),
      // Branded confirmation to the prospect — best-effort, never blocks the lead.
      sendInquiryConfirmation({
        businessName: listing.name,
        businessEmail: forwardTo,
        visitorName: name,
        visitorEmail: email,
        visitorPhone: phone,
        message,
        serviceNeeded,
        urgency,
      }),
    ]);

    const emailOk =
      emailResult.status === "fulfilled" && emailResult.value.success;
    const smsOk = smsResult.status === "fulfilled" && smsResult.value.success;

    let deliveryStatus: string;
    if (emailOk && smsOk) deliveryStatus = "both_sent";
    else if (emailOk) deliveryStatus = "email_sent";
    else if (smsOk) deliveryStatus = "sms_sent";
    else deliveryStatus = "failed";

    // leads_forwarded = delivery ledger (D1: disposition already stored above).
    const { data: lead, error: insertErr } = await supabaseAdmin
      .from("leads_forwarded")
      .insert({
        listing_id: listingId,
        vertical: verticalConfig.tablePrefix.replace(/_$/, ""),
        business_name: listing.name,
        business_email: forwardTo,
        business_phone: businessPhone || null,
        visitor_name: name,
        visitor_email: email,
        visitor_phone: phone || null,
        message: message || null,
        service_needed: serviceNeeded || null,
        urgency,
        source_directory: verticalConfig.displayDomain,
        source_page: request.headers.get("referer") || null,
        visitor_ip: visitorIp,
        visitor_user_agent: visitorUserAgent,
        email_forwarded_at: emailOk ? new Date().toISOString() : null,
        sms_forwarded_at: smsOk ? new Date().toISOString() : null,
        delivery_status: deliveryStatus,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Failed to insert lead:", insertErr.message);
    }

    return NextResponse.json({
      success: true,
      lead_id: lead?.id || null,
      delivery_status: deliveryStatus,
      forwarded: true,
    });
  }

  // ── FREE TIER with deliverable email ──────────────────────────────
  // TDL #472 Lead-to-Claim: pitch an UNCLAIMED, non-paying, not-recently-pitched,
  // not-suppressed listing with a CASL claim CTA via Resend; else plain Gmail
  // notification. The lead ALWAYS forwards; only the CTA is gated.
  const caslReady = !!(process.env.CASL_POSTAL_ADDRESS || "").trim();
  let pitched = false;

  if (shouldPitch(listing) && caslReady && !(await isSuppressed(forwardTo))) {
    // TDL #1047 — `last_claim_pitch_at` is the CASL anti-spam THROTTLE that shouldPitch()
    // reads. It was stamped AFTER the pitch was sent, unchecked: a silent failure means we
    // re-pitch the same address on every subsequent lead, forever. It cannot be un-swallowed
    // in place either — erroring AFTER the pitch has gone out would make the client retry and
    // send a SECOND pitch (the Mission A idempotency lesson). So RESERVE the throttle first
    // and only pitch if it landed: no throttle record => no pitch.
    const { error: throttleErr } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .update({ last_claim_pitch_at: new Date().toISOString() })
      .eq("id", listing.id);

    if (throttleErr) {
      console.error(
        `[forward-lead] CASL throttle write failed for ${listingSlug}: ${throttleErr.message} — pitch SUPPRESSED (lead still forwards below)`
      );
    } else {
      const url = claimUrl({ id: listing.id, slug: listingSlug }, inquiryId, CLAIM_PATH);
      const pitchResult = await sendClaimPitchForward({
        to: forwardTo,
        businessName: listing.name,
        visitorName: name,
        visitorEmail: email,
        visitorPhone: phone,
        message,
        serviceNeeded,
        urgency,
        claimUrl: url,
      });
      if (pitchResult.success && pitchResult.pitched) {
        pitched = true;
      }
      if (pitchResult.suppressedSmoke) {
        // Smoke suppressed the real send — release the reservation.
        const { error: releaseErr } = await supabaseAdmin
          .from(LISTINGS_TABLE)
          .update({ last_claim_pitch_at: listing.last_claim_pitch_at })
          .eq("id", listing.id);
        if (releaseErr) {
          console.error(
            `[forward-lead] failed to release CASL throttle for ${listingSlug}: ${releaseErr.message}`
          );
        }
      }
    }
  }

  if (!pitched) {
    await sendInquiryNotification(forwardTo, listing.name, {
      name,
      email,
      phone,
      message,
    }, listingSlug).catch(() => {});
  }

  return NextResponse.json({ success: true, forwarded: true, pitched });
}
