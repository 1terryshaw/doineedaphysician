"use client";

// health-leads-plus-conditional-rollout-v1 (TDL #1391) — owner dashboard card for Leads Plus on a health directory.
//   eligible, not bought → $19 USD/mo, 30-day free trial or pay now (checkout through empire-billing via /api/billing-redirect)
//   bought                → "active" + what it does
//   not eligible          → the reason, no buy buttons
// The copy never promises ranking, badges, "recommended" placement or referrals — Leads Plus here is the contact form only.
import { useState } from "react";
import verticalConfig from "@/lib/vertical.config";

const primary = (verticalConfig as { primaryColor: string }).primaryColor;

export default function HealthLeadsPlusPanel({
  slug, state, reason,
}: {
  slug: string;
  state: "active" | "available" | "unavailable";
  reason?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function buy(mode: "trial" | "direct") {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/billing-redirect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingSlug: slug, tier: "leads_plus", cycle: "monthly", mode }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { window.location.href = d.url; return; }
      setMsg(d.error || "Checkout is unavailable right now. Please try again.");
    } catch {
      setMsg("Checkout is unavailable right now. Please try again.");
    }
    setBusy(false);
  }

  return (
    <section id="leads-plus" data-testid="health-leads-plus-panel" data-state={state} className="mb-6 rounded-xl border p-5">
      <h2 className="text-lg font-semibold text-gray-900">Leads Plus</h2>
      <p className="mt-1 text-sm text-gray-600">
        Adds a &ldquo;Request a call back&rdquo; form to your listing. Patients share their name, contact details and a good time to
        reach them; each request is e-mailed straight to you. It does not change your position in search results or add any badge.
      </p>
      {state === "active" && (
        <p className="mt-3 text-sm font-medium text-green-800">Active — the contact form is live on your listing.</p>
      )}
      {state === "unavailable" && (
        <p data-testid="lp-unavailable" className="mt-3 text-sm text-gray-700">{reason}</p>
      )}
      {state === "available" && (
        <div className="mt-4">
          <p className="text-sm text-gray-900"><b>$19 USD / month</b> · 30-day free trial · cancel any time</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => buy("trial")} data-testid="lp-trial"
              className="px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-60" style={{ backgroundColor: primary }}>
              Start free 30-day trial
            </button>
            <button type="button" disabled={busy} onClick={() => buy("direct")} data-testid="lp-direct"
              className="px-4 py-2 rounded-lg font-semibold border-2 bg-white disabled:opacity-60" style={{ borderColor: primary, color: primary }}>
              Pay now
            </button>
          </div>
          {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}
        </div>
      )}
    </section>
  );
}
