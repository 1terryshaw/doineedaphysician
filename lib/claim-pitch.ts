// lib/claim-pitch.ts
// Lead-to-Claim Conversion Engine (TDL #472). Canonical empire helper — do not fork.
//
// When a clean inquiry forwards to an UNCLAIMED listing that has a deliverable scraped
// email, append a claim CTA + tracked claim link to the forward. Gating + URL shaping
// live here; the CASL-compliant render/send lives in lib/resend.ts.

import verticalConfig from "@/lib/vertical.config";

const PITCH_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000; // ≤ 1 pitch / 14 days / recipient

// Stable per-vertical key for attribution. Not every vertical.config has `slug` (some
// only have tablePrefix), so fall back: slug -> tablePrefix -> domain.
export function verticalKey(): string {
  const cfg = verticalConfig as { slug?: string; tablePrefix?: string; displayDomain?: string };
  return (
    cfg.slug ||
    (cfg.tablePrefix ? cfg.tablePrefix.replace(/_$/, "") : "") ||
    cfg.displayDomain ||
    "unknown"
  );
}

// Bare apex domain for links/footer. Not every config has `displayDomain` (cardetailer/
// plumber only have `domain`), so fall back to `domain` with any www stripped.
export function verticalDomain(): string {
  const cfg = verticalConfig as { displayDomain?: string; domain?: string };
  return cfg.displayDomain || (cfg.domain ? cfg.domain.replace(/^www\./, "") : "") || "";
}

// Per-vertical claim destination (TDL #472 manifest). '/claim/{slug}' for 46/48 active
// verticals (chiro included); '/pricing' for ontarioforyou; '/signup' for mortgagebroker.
export const CLAIM_PATH = "/claim/{slug}";

export interface PitchListing {
  id: string;
  slug?: string | null;
  claimed?: boolean | null;
  last_claim_pitch_at?: string | null;
  tier?: string | null;
  subscription_tier?: string | null;
  stripe_subscription_id?: string | null;
}

// Paid-customer signals — never pitch a real customer even if `claimed` is stale (spec #6).
function hasActiveSubscription(listing: PitchListing): boolean {
  if (listing.stripe_subscription_id) return true;
  const tier = (listing.tier || listing.subscription_tier || "").trim().toLowerCase();
  return tier !== "" && tier !== "free" && tier !== "seed" && tier !== "unclaimed";
}

/** Pitch only an unclaimed, non-paying listing not pitched in the last 14 days. */
export function shouldPitch(listing: PitchListing): boolean {
  if (listing.claimed) return false;
  if (hasActiveSubscription(listing)) return false;
  const last = listing.last_claim_pitch_at ? Date.parse(listing.last_claim_pitch_at) : 0;
  if (Number.isNaN(last)) return true; // unparseable timestamp → treat as never pitched
  return Date.now() - last > PITCH_INTERVAL_MS;
}

/**
 * Tracked claim link for the pitched business. Resolves the per-vertical destination
 * and appends attribution params (?src=lead&v=<vertical>&lid=<leadId>). leadId = the
 * *_inquiries disposition row id the pitch was attached to.
 */
export function claimUrl(
  listing: { id: string; slug?: string | null },
  leadId: string | null,
  claimPath: string = CLAIM_PATH,
): string {
  const base = `https://${verticalConfig.domain}`;
  const slugOrId = listing.slug ?? listing.id;
  const path = claimPath.includes("{slug}")
    ? claimPath.replace("{slug}", slugOrId)
    : claimPath;
  const sep = path.includes("?") ? "&" : "?";
  // Email-URL hardening: a quoted-printable transfer decodes `=<2 hex digits>` as a byte,
  // which corrupts any query value that starts with 2 hex chars. UUIDs always do, so the
  // lead id is prefixed with a non-hex marker ("i-", stripped on read in /api/claim). We
  // deliberately DON'T emit `&v=<verticalKey>` — verticalKeys like "ca"(terer)/"de"(nt)
  // would be mangled, and the vertical is already recorded server-side via verticalKey()
  // in /api/claim, so the param is redundant. `src=lead` + `i-`-prefixed lid are QP-safe.
  const lid = leadId ? `&lid=i-${encodeURIComponent(leadId)}` : "";
  return `${base}${path}${sep}src=lead${lid}`;
}

/** Plain-text claim CTA block (for the text/plain MIME part). */
export function claimCtaText(url: string, directoryName: string): string {
  return [
    ``,
    `— — —`,
    `This customer found you through ${directoryName}, where you have a free listing.`,
    `It's currently unclaimed, so leads like this aren't reaching you automatically.`,
    `Claim it (free, ~30 sec) and future requests come straight to your inbox:`,
    url,
  ].join("\n");
}

/** HTML claim CTA block (for the text/html MIME part). */
export function claimCtaHtml(url: string, directoryName: string): string {
  return `
  <div style="margin:24px 0 0;padding:16px 20px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
    <p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#92400e;">
      This customer found you through <strong>${directoryName}</strong>, where you have a free listing.
      It's currently <strong>unclaimed</strong>, so leads like this aren't reaching you automatically.
    </p>
    <a href="${url}" style="display:inline-block;padding:10px 20px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
      Claim your free listing (~30 sec) →
    </a>
    <p style="margin:10px 0 0;font-size:12px;color:#b45309;">Once claimed, future requests come straight to your inbox.</p>
  </div>`;
}
