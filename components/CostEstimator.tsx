"use client";

// components/CostEstimator.tsx — VERTICAL-AGNOSTIC interactive Cost Estimator (v2).
// Service → complexity → region → live market-correct range from /api/cost-estimate
// (US$ / CA$ / £), then a CTA into the local directory filtered by region. Renders
// whatever services/markets/currency the API returns. CTA target = /directory?region=<CODE>
// (universal across stampers); /directory fallback when n=0.

import { useEffect, useMemo, useState } from "react";
import verticalConfig from "@/lib/vertical.config";

interface ComplexityMap { [label: string]: number; }

export interface CostServiceProp {
  service: string;
  service_label: string;
  base_low: number;
  base_high: number;
  unit: string;
  complexity_options: ComplexityMap;
  notes: string | null;
}
export interface RegionOptionProp {
  slug: string;
  code: string;
  label: string;
  market: "us" | "ca" | "uk";
  country: string;
}
interface EstimateResponse {
  service_label: string;
  complexity: string | null;
  region: string | null;
  region_name: string | null;
  region_slug: string | null;
  market: string;
  currency: string;
  currency_symbol: string;
  market_fallback: boolean;
  unit: string;
  low: number;
  high: number;
  n_pros_nearby: number;
  disclaimer: string;
}

const OTHER_REGION = "__other__";
const DEFAULT_SYMBOL = "US$";

const cfg = verticalConfig as {
  listingNoun?: string; listingNounPlural?: string;
  entity?: string; entityPlural?: string;
  primaryColor?: string; ctaColor?: string;
};
const NOUN = (cfg.listingNoun || cfg.entity || "pro").toString().toLowerCase();
const NOUN_PLURAL = (cfg.listingNounPlural || cfg.entityPlural || `${NOUN}s`).toString().toLowerCase();

function article(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}
function sortedComplexity(opts: ComplexityMap): { label: string; multiplier: number }[] {
  return Object.entries(opts)
    .map(([label, multiplier]) => ({ label, multiplier: Number(multiplier) }))
    .sort((a, b) => a.multiplier - b.multiplier || a.label.localeCompare(b.label));
}
function defaultComplexityLabel(opts: ComplexityMap): string {
  const list = sortedComplexity(opts);
  if (list.length === 0) return "";
  return list.reduce((best, o) => (Math.abs(o.multiplier - 1) < Math.abs(best.multiplier - 1) ? o : best)).label;
}
function money(n: number, symbol: string): string { return `${symbol}${n.toLocaleString("en-US")}`; }

export default function CostEstimator({
  services, regions,
}: { services: CostServiceProp[]; regions: RegionOptionProp[]; }) {
  const primary = cfg.primaryColor || "#2563eb";

  const [serviceKey, setServiceKey] = useState(services[0]?.service ?? "");
  const selectedService = useMemo(
    () => services.find((s) => s.service === serviceKey) ?? services[0],
    [services, serviceKey]
  );
  const [complexity, setComplexity] = useState(defaultComplexityLabel(selectedService?.complexity_options ?? {}));
  const [region, setRegion] = useState("");
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regionGroups = useMemo(() => {
    const groups: { country: string; options: RegionOptionProp[] }[] = [];
    for (const r of regions) {
      let g = groups.find((x) => x.country === r.country);
      if (!g) { g = { country: r.country, options: [] }; groups.push(g); }
      g.options.push(r);
    }
    return groups;
  }, [regions]);

  useEffect(() => {
    setComplexity(defaultComplexityLabel(selectedService?.complexity_options ?? {}));
  }, [selectedService]);

  useEffect(() => {
    if (!serviceKey || !complexity) return;
    const regionCode = region && region !== OTHER_REGION ? region : null;
    let cancelled = false;
    setLoading(true); setError(null);
    fetch("/api/cost-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: serviceKey, complexity, region: regionCode }),
    })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error || "Estimate failed"); return r.json(); })
      .then((data: EstimateResponse) => { if (!cancelled) setResult(data); })
      .catch((e) => { if (!cancelled) setError(e.message || "Could not load estimate"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [serviceKey, complexity, region]);

  const regionName = result?.region_name || regions.find((r) => r.code === region)?.label || "your area";
  const symbol = result?.currency_symbol || DEFAULT_SYMBOL;
  const proCount = result?.n_pros_nearby ?? 0;
  // CTA → /directory?region=<CODE> (universal); /directory fallback when n=0.
  const ctaHref = result?.region && proCount > 0
    ? `/directory?region=${encodeURIComponent(result.region)}`
    : "/directory";
  const ctaLabel = proCount > 0
    ? `Get exact quotes from ${proCount.toLocaleString("en-US")} ${NOUN_PLURAL} near you`
    : `Browse ${NOUN_PLURAL} near you`;

  const lowDisplay = result ? result.low : selectedService?.base_low ?? 0;
  const highDisplay = result ? result.high : selectedService?.base_high ?? 0;
  const unitDisplay = result?.unit ?? selectedService?.unit ?? "";
  const showFallbackNote = region === OTHER_REGION || (result?.market_fallback ?? false);

  const selectClass =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

  return (
    <div>
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
        How much does {article(NOUN)} {NOUN} cost in {regionName}?
      </h1>
      <p className="text-gray-600 mb-8 max-w-2xl">
        Pick a service, the details, and your location to see a realistic price range in your local
        currency — then get exact quotes from {NOUN_PLURAL} near you.
      </p>

      <div className="grid gap-5 md:grid-cols-3 mb-8">
        <div>
          <label htmlFor="ce-service" className="block text-sm font-semibold text-gray-700 mb-2">1. Service</label>
          <select id="ce-service" className={selectClass} value={serviceKey} onChange={(e) => setServiceKey(e.target.value)}>
            {services.map((s) => <option key={s.service} value={s.service}>{s.service_label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ce-complexity" className="block text-sm font-semibold text-gray-700 mb-2">2. Details</label>
          <select id="ce-complexity" className={selectClass} value={complexity} onChange={(e) => setComplexity(e.target.value)}>
            {sortedComplexity(selectedService?.complexity_options ?? {}).map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ce-region" className="block text-sm font-semibold text-gray-700 mb-2">3. Location</label>
          <select id="ce-region" className={selectClass} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Select your state / province…</option>
            {regionGroups.map((g) => (
              <optgroup key={g.country} label={g.country}>
                {g.options.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </optgroup>
            ))}
            {/* 'Other' last — empire dropdown standard */}
            <option value={OTHER_REGION}>Other / not listed</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-6 md:p-8 mb-6" aria-live="polite">
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <>
            <p className="text-sm uppercase tracking-wide text-gray-500 mb-1">
              Estimated cost — {result?.service_label ?? selectedService?.service_label}
              {result?.complexity ? ` · ${result.complexity}` : ""}
              {result?.currency ? ` · ${result.currency}` : ""}
            </p>
            <div className="flex items-end gap-3 flex-wrap">
              <span className="text-4xl md:text-5xl font-extrabold" style={{ color: primary }}>
                {`${money(lowDisplay, symbol)} – ${money(highDisplay, symbol)}`}
              </span>
              <span className="text-gray-500 mb-1">{unitDisplay}</span>
              {loading && <span className="text-sm text-gray-400 mb-1">updating…</span>}
            </div>
            {showFallbackNote && (
              <p className="text-xs text-gray-500 mt-2">
                Showing a US baseline (US$) — pick your state or province for a location-adjusted range in local currency.
              </p>
            )}
            {selectedService?.notes && <p className="text-sm text-gray-600 mt-3">{selectedService.notes}</p>}
          </>
        )}
      </div>

      <a
        href={ctaHref}
        className="inline-flex items-center justify-center rounded-xl px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:opacity-90"
        style={{ backgroundColor: cfg.ctaColor || primary }}
      >
        {ctaLabel} →
      </a>

      <p className="text-xs text-gray-500 mt-6 max-w-2xl">
        {result?.disclaimer ??
          "These ranges are estimates only. Actual cost varies by provider, scope of service, and your specific situation. Always confirm pricing directly with the business."}
      </p>
    </div>
  );
}
