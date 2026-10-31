// health-leads-plus-conditional-rollout-v1 (TDL #1391) — the Leads Plus offer on /pricing for a HEALTH directory.
// Kept outside PricingTable (shared, do-not-modify). The CTAs carry the owner's choice (?plan=leads-plus&cycle=monthly&mode=…)
// through claim / login to its checkout (lp_intent, K432 rule 4). Eligibility is decided per listing on the owner dashboard.
// The copy never promises ranking, badges, "recommended" placement or referrals.
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

const primary = (verticalConfig as { primaryColor: string }).primaryColor;
const href = (mode: "trial" | "direct") => `/claim?plan=leads-plus&cycle=monthly&mode=${mode}`;

export default function HealthLeadsPlusCard() {
  return (
    <section data-testid="health-leads-plus-card" className="mt-12 max-w-3xl mx-auto rounded-xl border p-6">
      <h2 className="text-xl font-bold text-gray-900">Leads Plus</h2>
      <p className="mt-1 text-gray-900"><b>$19 USD / month</b> · 30-day free trial · monthly · cancel any time</p>
      <ul className="mt-3 space-y-1 text-sm text-gray-700 list-disc pl-5">
        <li>A &ldquo;Request a call back&rdquo; form on your claimed listing</li>
        <li>Patients share only their name, contact details and a good time to reach them — no health details</li>
        <li>Each request is e-mailed straight to you</li>
      </ul>
      <p className="mt-3 text-xs text-gray-500">
        Leads Plus does not change your position in search results, add a badge or affect any recommendation. A flat monthly fee
        — never a per-lead or referral fee. Available for verified listings where local rules allow it.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={href("trial")} data-testid="lp-card-trial" className="px-4 py-2 rounded-lg font-semibold text-white" style={{ backgroundColor: primary }}>
          Start free 30-day trial
        </Link>
        <Link href={href("direct")} data-testid="lp-card-direct" className="px-4 py-2 rounded-lg font-semibold border-2 bg-white" style={{ borderColor: primary, color: primary }}>
          Pay now — $19/mo
        </Link>
      </div>
    </section>
  );
}
