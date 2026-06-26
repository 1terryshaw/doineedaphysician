import type { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import PersonalityBadge from "@/components/pizzazz/PersonalityBadge";
import ShareButtons from "@/components/pizzazz/ShareButtons";
import FadeIn from "@/components/pizzazz/FadeIn";
import { BrowseByArea } from "@/components/browse-by-area";
import { websiteSearchSchema } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
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
              Verified Listings
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              No Spam
            </span>
          </div>
        </div>
      </section>

      {/* Share Buttons */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <ShareButtons variant="compact" title={`${verticalConfig.name} — ${verticalConfig.tagline}`} />
      </div>

      {/* Types of Physicians */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">
            Types of Physicians
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {verticalConfig.categoryLabels.map((cat) => (
              <Link
                key={cat.slug}
                href={`/directory?listing_type=${cat.slug}`}
                className="block p-5 bg-white border rounded-xl text-center card-lift"
              >
                <span className="text-3xl block mb-2">{cat.emoji}</span>
                <span className="font-semibold text-gray-900 text-sm">{cat.label}</span>
                <span className="block text-xs text-gray-500 mt-1 line-clamp-2">
                  {cat.description}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      {/* Browse by Area (replaces LocationPicker — TDL #138) */}
      <FadeIn as="div" delay={100}>
        <BrowseByArea
          vertical="ther"
          accentTextClass="text-[#3B82F6] hover:text-[#306bca]"
        />
      </FadeIn>

    </>
  );
}
