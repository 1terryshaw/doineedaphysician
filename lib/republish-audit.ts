// Compliance audit sink for republish-on-claim decisions.
// Every guard decision (ALLOW or DENY) is recorded to public.empire_republish_decisions
// so a compliance flip is reconstructable later. Fail-closed callers MUST NOT flip
// is_published unless logRepublishDecision() resolves true.
//
// Ported from doineedawebdesigner@f217317. The only per-repo delta is `vertical_slug`:
// the STAMPED CONSTANT below is the empire_verticals registry value for this repo
// (matched on primary_domain), which is what analytics.ts stamps. Deriving it from
// LISTINGS_TABLE would be right by luck here and wrong elsewhere,
// so it is stated explicitly in every repo.
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { REPUBLISH_GUARD_VERSION, type RepublishDecision, type RepublishInput } from "@/lib/republish-guard";

const VERTICAL_SLUG = "physicians";

export type RepublishAuditRow = {
  listing_id: string | number | null;
  listing_slug: string | null;
  input: RepublishInput;
  decision: RepublishDecision;
};

/**
 * Insert one audit row. Returns true iff the row was recorded.
 * A false return means the decision is NOT durably logged — callers must treat that
 * as "do not republish" (fail-closed), because an unlogged flip is unreconstructable.
 */
export async function logRepublishDecision(r: RepublishAuditRow): Promise<boolean> {
  const { error } = await supabaseAdmin.from("empire_republish_decisions").insert({
    vertical_slug: VERTICAL_SLUG,
    listings_table: LISTINGS_TABLE,
    listing_id: r.listing_id == null ? null : String(r.listing_id),
    listing_slug: r.listing_slug,
    deserve_reason: r.input.deserve_reason ?? null,
    name_present: /[A-Za-z]/.test(r.input.name ?? ""),
    is_published_before: r.input.is_published,
    verdict: r.decision.reason_code,
    allow: r.decision.allow,
    guard_version: REPUBLISH_GUARD_VERSION,
    actor: "claim_verify",
  });
  if (error) {
    console.error(`[republish-audit] insert FAILED (${r.listing_slug}): ${error.message}`);
    return false;
  }
  return true;
}
