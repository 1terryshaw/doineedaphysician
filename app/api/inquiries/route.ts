// NO FREE LEADS (health-leads-plus-conditional-rollout-v1, TDL #1391; fleet standard leads-plus-canary-v1 addendum A): the legacy
// free inquiry path is REMOVED on this health directory. It collected an unbounded free-text message (and service / urgency
// fields) with no "no health details" notice and stored it — outside CEO/COO boundary 6. Free and unclaimed listings get no
// contact form; a Leads Plus listing takes requests only through /api/leads-plus/lead (rules-table gated, no stored note).
// Any POST here — a stale page or a crafted request — is refused, nothing is stored or sent.
// The previous implementation lives in git history (tag working-pre-healthlp).
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ error: "This practice is not accepting online inquiries." }, { status: 403 });
}
