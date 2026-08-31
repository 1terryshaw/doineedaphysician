import type { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import PersonalityBadge from "@/components/pizzazz/PersonalityBadge";
import FadeIn from "@/components/pizzazz/FadeIn";
import { BrowseByArea } from "@/components/browse-by-area";
import RegionHub, { type HubSection, type HubRegion } from "@/components/RegionHub";
import { getRegionByProvinceCode, countryOfProvinceCode } from "@/lib/constants";
import { websiteSearchSchema } from "@/lib/seo";
import { getSpecialtyCounts, getRegionCounts } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default async function HomePage() {
  // WS1 (site-surfer day-3) — market-aware Browse-by-Area index. The heading
  // used to stand over a single "/directory" link. It now carries the SAME
  // data-true region hub the directory serves: one section per COUNTRY present
  // in published inventory, each listing THAT market's own subdivision — CA
  // provinces, US states
  // — with its live published count. The slug comes from getRegionByProvinceCode,
  // i.e. THIS repo's own REGIONS table, so the chip href is whatever /[region]
  // actually resolves here. An unmapped code is SKIPPED, never linked (K119/K123).
  // Keyed by SLUG and summed: the hub at /<slug> serves every row with that
  // province_state, so a stray row whose `country` disagrees with its code (a
  // handful exist fleet-wide) must not mint a SECOND chip in the other section.
  // The CODE decides the country, because the code is what picks the hub.
  const bbaByCode = new Map<string, { country: "CA" | "US"; region: HubRegion }>();
  for (const c of await getRegionCounts()) {
    const r = getRegionByProvinceCode(c.province_state);
    if (!r) continue; // unmapped code — would 404
    const prev = bbaByCode.get(r.slug);
    if (prev) { prev.region.count += c.n; continue; }
    bbaByCode.set(r.slug, {
      country: countryOfProvinceCode(c.province_state) === "CA" ? "CA" : "US",
      region: { slug: r.slug, name: r.name, count: c.n },
    });
  }
  const bbaCa: HubRegion[] = [];
  const bbaUs: HubRegion[] = [];
  for (const e of Array.from(bbaByCode.values())) (e.country === "CA" ? bbaCa : bbaUs).push(e.region);
  const bbaByName = (a: HubRegion, b: HubRegion) => a.name.localeCompare(b.name);
  bbaCa.sort(bbaByName);
  bbaUs.sort(bbaByName);
  const regionSections: HubSection[] = [];
  if (bbaCa.length) regionSections.push({ country: "CA", label: "🇨🇦 Canada", regions: bbaCa });
  if (bbaUs.length) regionSections.push({ country: "US", label: "🇺🇸 United States", regions: bbaUs });

  const counts = await getSpecialtyCounts();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSearchSchema()) }}
      />
      {/* Hero */}
      <section
        className="py-16 md:py-20 px-4 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${verticalConfig.heroGradientFrom}, ${verticalConfig.heroGradientVia}, ${verticalConfig.heroGradientTo})`,
        }}
      >
        {/* Floating dots pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute w-2 h-2 rounded-full bg-white/10 top-[15%] left-[10%]" />
          <div className="absolute w-3 h-3 rounded-full bg-white/[0.07] top-[30%] right-[15%]" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-white/10 top-[60%] left-[25%]" />
          <div className="absolute w-2.5 h-2.5 rounded-full bg-white/[0.06] top-[20%] right-[35%]" />
          <div className="absolute w-2 h-2 rounded-full bg-white/[0.08] top-[70%] right-[10%]" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-white/10 top-[45%] left-[60%]" />
          <div className="absolute w-3 h-3 rounded-full bg-white/[0.05] top-[80%] left-[40%]" />
          <div className="absolute w-2 h-2 rounded-full bg-white/[0.08] top-[10%] left-[50%]" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-white/[0.07] top-[55%] right-[30%]" />
        </div>
        <div className="max-w-3xl mx-auto text-center text-white relative">
          <h1 className="text-3xl md:text-5xl font-bold mb-3 animate-fade-up">
            Find a Physician Near You
          </h1>
          <p className="text-lg md:text-xl opacity-90 mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Search a public directory of licensed physicians by specialty and location
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/directory"
              className="px-8 py-3 rounded-lg font-semibold text-white transition-colors text-center"
              style={{ backgroundColor: verticalConfig.ctaColor }}
            >
              Find a Physician &rarr;
            </Link>
            <Link
              href="/directory"
              className="px-8 py-3 border-2 border-white rounded-lg font-semibold text-white hover:bg-white/10 transition-colors text-center"
            >
              Browse Physicians
            </Link>
          </div>
          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 mt-10 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Free to Search
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Compiled from Public Records
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              No Spam
            </span>
          </div>
        </div>
      </section>

      {/* Section A — Browse by specialty (internal /specialty/<slug> tiles).
          Counts render dynamically from physician_specialty_counts(); tiles always
          link to /specialty/<slug> (never a dead end — empty-state handled there). */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">
            Browse by Specialty
          </h2>
          <p className="text-center text-gray-500 mb-8 text-sm">
            Find physicians by their medical specialty
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {verticalConfig.categoryLabels.map((cat) => {
              const n = counts[cat.slug] ?? 0;
              return (
                <Link
                  key={cat.slug}
                  href={`/specialty/${cat.slug}`}
                  className="block p-5 bg-white border rounded-xl text-center card-lift"
                >
                  <span className="text-3xl block mb-2">{cat.emoji}</span>
                  <span className="font-semibold text-gray-900 text-sm">{cat.label}</span>
                  <span className="block text-xs text-gray-500 mt-1 line-clamp-2">
                    {cat.description}
                  </span>
                  <span className="block text-xs font-medium mt-2 text-[#3B82F6]">
                    {n > 0 ? `${fmt(n)} listed` : "Browse →"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section B — Related specialists (external empire directories). */}
      <section className="py-12 px-4 bg-gray-50 border-y">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">
            Related specialists
          </h2>
          <p className="text-center text-gray-500 mb-8 text-sm">
            Looking for something else? These specialists have their own directories.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {verticalConfig.relatedSpecialists.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 bg-white border rounded-xl text-center card-lift"
              >
                <span className="inline-flex items-center justify-center gap-1 font-semibold text-gray-900 text-sm">
                  {s.label}
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5m0 0v5m0-5L10 14M9 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-3" />
                  </svg>
                </span>
                <span className="block text-xs text-gray-500 mt-1 line-clamp-2">
                  {s.description}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by Area (replaces LocationPicker — TDL #138) */}
      <FadeIn as="div" delay={100}>
        <BrowseByArea
          vertical="physician"
          subtitle="Find a physician in your area"
          accentTextClass="text-[#3B82F6] hover:text-[#306bca]"
        />
        {regionSections.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 pb-4">
            <RegionHub sections={regionSections} />
          </div>
        )}
      </FadeIn>

    </>
  );
}
