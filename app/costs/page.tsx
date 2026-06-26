import { Metadata } from "next";
import verticalConfig from "@/lib/vertical.config";
import { SITE_URL, canonicalUrl } from "@/lib/seo";
import {
  getCostServices,
  getRegionOptions,
  DEFAULT_MARKET,
  currencySymbol,
} from "@/lib/cost-models";
import CostEstimator from "@/components/CostEstimator";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PAGE_PATH = "/costs";

const cfg = verticalConfig as {
  listingNoun?: string;
  listingNounPlural?: string;
  entity?: string;
  entityPlural?: string;
  name?: string;
};
const NOUN = (cfg.listingNoun || cfg.entity || "pro").toString().toLowerCase();
const NOUN_PLURAL = (cfg.listingNounPlural || cfg.entityPlural || `${NOUN}s`).toString().toLowerCase();
const SITE_NAME = cfg.name || NOUN_PLURAL;

/** "a"/"an" for a word/phrase. */
function article(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}

const TITLE = `How much does ${article(NOUN)} ${NOUN} cost? Free cost estimator`;
const DESCRIPTION = `Estimate what common ${NOUN} services cost by service and location, in your local currency. Then get exact quotes from ${NOUN_PLURAL} near you.`;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: PAGE_PATH },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: canonicalUrl(PAGE_PATH),
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

export default async function CostsPage() {
  const [services, regions] = await Promise.all([
    getCostServices(DEFAULT_MARKET),
    getRegionOptions(),
  ]);
  const baseSymbol = currencySymbol("USD");

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: TITLE,
    description: DESCRIPTION,
    url: canonicalUrl(PAGE_PATH),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    about: { "@type": "Thing", name: `${NOUN} service costs` },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Cost estimator", item: canonicalUrl(PAGE_PATH) },
    ],
  };
  // FAQPage from seeded default-market services. Labels are countable singular
  // nouns, so "a/an <label>" + "ranges" reads grammatically across verticals.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: services.map((s) => {
      const label = s.service_label;
      const lo = `${baseSymbol}${s.base_low.toLocaleString("en-US")}`;
      const hi = `${baseSymbol}${s.base_high.toLocaleString("en-US")}`;
      const art = article(label);
      return {
        "@type": "Question",
        name: `How much does ${art} ${label.toLowerCase()} cost?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${art.charAt(0).toUpperCase() + art.slice(1)} ${label.toLowerCase()} typically ranges from ${lo} to ${hi} ${s.unit}. ${
            s.notes ?? ""
          } Costs vary by provider and location — use the estimator above for live local pricing in your currency.`
            .replace(/\s+/g, " ")
            .trim(),
        },
      };
    }),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      {services.length === 0 ? (
        <p className="text-gray-500 py-12">The cost estimator is being set up. Please check back soon.</p>
      ) : (
        <CostEstimator services={services} regions={regions} />
      )}
    </div>
  );
}
