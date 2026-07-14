import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "../../../lib/supabase";
import { suppressEmail } from "@/lib/suppression";

// Unsubscribe endpoint. One source of truth — stamped into every empire directory.
// Handles the two COMMERCIAL flows, both backed by the central public.email_suppressions list:
//   ?email=&scope=pitch   claim-pitch unsubscribe   -> email_suppressions (+ row mirror)
//   ?token=&email=        cold-outreach unsubscribe -> email_suppressions (+ row mirror)
//
// TDL #1057 — a third branch (`?slug=&token=` -> `owner_email = null`, "owner-notification
// unsubscribe") was DELETED here. Do not reintroduce it. It was a no-op that returned 200:
// the inquiry send path resolves its destination via effectiveForwardEmail() (lib/inquiry-guard),
// which FALLS BACK TO THE SCRAPED `email` COLUMN when owner_email is null — so clearing
// owner_email stopped nothing, and we kept emailing the address. `owner_email = null` is also
// the DEFAULT state of every unclaimed listing, so the write carried no information at all.
// It was also unreachable: no code, template, or script in the empire has ever emitted that URL.
// Nulling owner_email additionally destroyed the owner's magic-link login address.
//
// An owner-facing notification opt-out, if we ever want one, needs a dedicated flag that the
// send path checks BEFORE resolving the fallback — plus a link in the notification email.
// That is an open PRODUCT question, not a bug fix.

export const dynamic = "force-dynamic";

// TDL #472 claim-pitch unsubscribe. Unsigned email param, mirroring the signed-off
// doineedapro CASL baseline (one-click ?email= → suppress). Writes the AUTHORITATIVE
// central public.email_suppressions list, which isSuppressed() reads. Also mirrors to
// the per-vertical outreach_unsubscribed flag (belt-and-suspenders, harmless).
async function suppressPitch(email: string): Promise<boolean> {
  const res = await suppressEmail(email, "claim_pitch_unsubscribe", "claim_pitch_one_click");
  if (!res.ok) {
    console.error(`[unsubscribe] CENTRAL SUPPRESSION FAILED for ${email}: ${res.error}`);
  }
  // Per-listing mirror. K36 (TDL #1041): the error here was previously discarded outright
  // via `.then(undefined, () => undefined)`. The central write above is the guarantee.
  const { error: rowErr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ outreach_unsubscribed: true })
    .eq("email", email);
  if (rowErr) {
    console.error(`[unsubscribe] row-flag write failed for ${email}: ${rowErr.message}`);
  }
  return res.ok;
}

/**
 * TDL #1041 — cold-outreach unsubscribe.
 *
 * The CENTRAL list is written FIRST and is authoritative: lib/suppression.ts calls
 * public.email_suppressions the source of truth and *_listings.outreach_unsubscribed
 * "a downstream copy". This route previously wrote ONLY the row flag, checked neither the
 * returned error nor the row count, and then told the user "You have been unsubscribed"
 * unconditionally — so a token mismatch, a changed email or a deleted listing suppressed
 * NOTHING while the page confirmed success. It also never wrote the central list directly;
 * that depended on a DB trigger which only fires when the row update matches a row.
 *
 * Writing the central list first makes a zero-row mirror non-fatal: the address is suppressed
 * either way. Both senders honor that one list — empire-outreach.ts (TDL #472) and
 * empire-drip-sender.ts (TDL #1041) — so a single write stops every commercial send.
 */
async function suppressCold(
  email: string,
  token: string
): Promise<{ ok: boolean; rows: number }> {
  const sup = await suppressEmail(email, "outreach_unsubscribe", "cold_outreach_one_click");
  if (!sup.ok) {
    console.error(`[unsubscribe] CENTRAL SUPPRESSION FAILED for ${email}: ${sup.error}`);
  }
  const { error, count } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update({ outreach_unsubscribed: true }, { count: "exact" })
    .eq("outreach_unsub_token", token)
    .eq("email", email);
  if (error) {
    console.error(`[unsubscribe] row-flag write failed for ${email}: ${error.message}`);
  } else if ((count ?? 0) === 0) {
    console.warn(
      `[unsubscribe] row-flag matched 0 rows for ${email} (token mismatch?) — central suppression still applied.`
    );
  }
  return { ok: sup.ok, rows: count ?? 0 };
}

function page(title: string, body: string, status: number) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:sans-serif;max-width:600px;margin:60px auto;text-align:center">` +
      `<h1>${title}</h1>${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const scope = searchParams.get("scope");

  // Claim-pitch unsubscribe (TDL #472): ?email=u-<addr>&scope=pitch -> email_suppressions
  // (the "u-" is the QP-hardening marker added in lib/resend.ts; strip exactly one).
  if (scope === "pitch" && email) {
    const ok = await suppressPitch(email.replace(/^u-/, ""));
    if (!ok) {
      return page(
        "We could not complete your unsubscribe",
        "<p>A system error stopped us from recording your request. " +
          "Please reply to terry@marketingteaminabox.com and we will remove you immediately.</p>",
        500
      );
    }
    return page(
      "You have been unsubscribed",
      "<p>You will not receive any more listing-claim emails from us at this address.</p>" +
        "<p>If this was a mistake, reply to terry@marketingteaminabox.com</p>",
      200
    );
  }

  // Cold-outreach unsubscribe: ?token=&email=  ->  outreach_unsubscribed = true
  if (token && email) {
    const r = await suppressCold(email, token);
    if (!r.ok) {
      return page(
        "We could not complete your unsubscribe",
        "<p>A system error stopped us from recording your request. " +
          "Please reply to terry@marketingteaminabox.com and we will remove you immediately.</p>",
        500
      );
    }

    return page(
      "You have been unsubscribed",
      "<p>You will not receive any more emails from us about this listing.</p>" +
        "<p>If this was a mistake, reply to terry@marketingteaminabox.com</p>",
      200
    );
  }

  return page(
    "Invalid unsubscribe link",
    "<p>This link is missing required parameters. " +
      "Contact terry@marketingteaminabox.com for help.</p>",
    400
  );
}

// RFC 8058 one-click unsubscribe — mail clients POST here when honoring the
// List-Unsubscribe-Post: List-Unsubscribe=One-Click header on claim-pitch CEMs.
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  const ok = await suppressPitch(email.replace(/^u-/, ""));
  return NextResponse.json({ success: ok });
}
