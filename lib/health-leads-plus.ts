// health-leads-plus-conditional-rollout-v1 (TDL #1391, CEO/COO CONDITIONAL GO 2026-10-31) — Leads Plus on a HEALTH directory.
//
// What Leads Plus is here: a contact-request form on the owner's listing, and nothing else. On this vertical
// (empire_verticals.lp_neutral_placement) it must never change ranking/sort, the AI advisor, badges or "recommended" output,
// never pay a referral, and never steer patients. empire-billing therefore writes ONLY leads_plus_enabled on a purchase —
// tier / featured are left as they were (empire-billing lib/neutral-placement.ts), so every sort key is untouched.
//
// Per-listing eligibility (claim, source rights, jurisdiction rule, held jurisdictions such as US-FL) is decided in ONE place:
// public.health_lp_listing_eligible (rules table public.health_lp_rules is the source of truth). It fails closed.
import { supabaseAdmin } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";
import { isValidEmail } from "@/lib/inquiry-guard";
export { PREFERRED_TIMES, MESSAGE_MAX, CRISIS_LINE, type PreferredTime } from "@/lib/health-leads-plus-shared";

export type HealthLpRule = {
  eligible: boolean;
  reason?: string;
  jurisdiction?: string;
  free_text?: boolean;    // short message box (with the no-health-details notice); false on the therapist site
  crisis_line?: boolean;  // crisis-resource line above the form (therapist site)
  review_bodies?: boolean;
  content_kit?: boolean;
};

export const REGISTRY_SLUG = "physicians"; // empire_verticals.vertical_slug for this site

// Fixture convention (mirrors empire-billing's reserved prefix): no real listing slug starts with it.
export const TEST_FIXTURE_SLUG_PREFIX = "test-leadsplus-";
export const TEST_INBOX = "terry@marketingteaminabox.com";

/** Leads Plus is sold on this health site (the per-listing rule decides each listing). */
export function verticalAllowsLeadForms(): boolean {
  return (verticalConfig as { leadsPlusAllowed?: boolean }).leadsPlusAllowed !== false;
}

/** The listing's eligibility under the rules table. Any error → not eligible (fail closed). */
export async function healthLpRule(slug: string): Promise<HealthLpRule> {
  try {
    const { data, error } = await supabaseAdmin.rpc("health_lp_listing_eligible", { p_vertical: REGISTRY_SLUG, p_slug: slug });
    if (error || !data) return { eligible: false, reason: "eligibility_check_failed" };
    return data as HealthLpRule;
  } catch {
    return { eligible: false, reason: "eligibility_check_failed" };
  }
}

export type LpListing = { slug: string; claimed?: boolean | null; owner_email?: string | null; leads_plus_enabled?: boolean | null };

/** THE lead-form gate: purchased (leads_plus_enabled) AND claimed AND a deliverable owner e-mail AND eligible under the rules. */
export function leadFormOn(listing: LpListing | null | undefined, rule: HealthLpRule): boolean {
  return (
    verticalAllowsLeadForms() &&
    !!listing &&
    listing.leads_plus_enabled === true &&
    listing.claimed === true &&
    isValidEmail(listing.owner_email ?? null) &&
    rule.eligible === true
  );
}

/** Owner-facing wording for an ineligibility reason (never a ranking or quality claim). */
export function ineligibleText(reason?: string): string {
  switch (reason) {
    case "not_claimed": return "Claim and verify your listing first.";
    case "jurisdiction_held": return "Leads Plus is not yet available in your state or province while we confirm local rules.";
    case "source_rights": return "Leads Plus is not yet available for this listing.";
    case "no_rule_for_jurisdiction": return "Leads Plus is not yet available in your location.";
    default: return "Leads Plus is not available for this listing yet.";
  }
}

/** A lead is a TEST lead off-production or on the reserved fixture. Test e-mail subjects start with "[TEST]". */
export function isTestContext(slug: string): boolean {
  return process.env.VERCEL_ENV !== "production" || slug.startsWith(TEST_FIXTURE_SLUG_PREFIX);
}

// Lead-volume guard per listing (no paid service; counted from public.health_lp_leads).
export const LEADS_PER_LISTING_PER_DAY = 20;
