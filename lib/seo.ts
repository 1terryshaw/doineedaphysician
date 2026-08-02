import verticalConfig from "@/lib/vertical.config";

/**
 * Production canonical site URL. Derives strictly from verticalConfig.domain
 * (stored as the APEX form) so canonical/robots/sitemap always match the served
 * APEX origin. Vercel serves the apex and 308-redirects www -> apex, so the
 * canonical host MUST be apex (matches the CLAUDE.md Domain Rules). The earlier
 * www form made canonical/og disagree with the served apex host and produced an
 * apex/www mismatch ("Page with redirect" + "Duplicate, Google chose different"
 * in GSC). The NEXT_PUBLIC_BASE_URL env override stays removed — canonical is
 * code-derived, not env-driven. See canonical-host-align.
 *
 * Trailing slash stripped so callers can concatenate paths safely.
 */
const cfgDomain = (verticalConfig as { domain?: string }).domain;

export const SITE_URL = (
  cfgDomain ? `https://${cfgDomain}` : "http://localhost:3000"
).replace(/\/$/, "");

/**
 * Build an absolute canonical URL for the given path.
 * Pass paths starting with "/" (e.g. "/directory", "/toronto/toronto").
 */
export function canonicalUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

/**
 * Sitewide Organization schema (F-α.1b Step 1). Inject as <script
 * type="application/ld+json"> in the root layout so every page inherits it.
 * contactPoint is conditional: omitted when verticalConfig.supportEmail is
 * absent (avoids emitting an empty ContactPoint via JSON.stringify).
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: verticalConfig.name,
    url: SITE_URL,
    description: verticalConfig.description,
    ...(verticalConfig.supportEmail
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            email: verticalConfig.supportEmail,
            contactType: "customer support",
          },
        }
      : {}),
  };
}

/**
 * Homepage-only WebSite schema with potentialAction:SearchAction (F-α.1b
 * Step 2). Eligible for Google's sitelinks search box. /directory?q= verified.
 */
export function websiteSearchSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: SITE_URL,
    name: verticalConfig.name,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/directory?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * BreadcrumbList for region pages (F-α.1b Step 3). Home → {region}.
 */
export function regionBreadcrumbSchema(regionSlug: string, regionName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: regionName, item: `${SITE_URL}/${regionSlug}` },
    ],
  };
}

/**
 * Minimal CollectionPage for region pages (F-α.1b Step 3). Noun read from
 * verticalConfig.listingNounPlural (singular fallback for count===1). Province
 * dropped from bookkeeper's 4-arg form (no uniform source empire-wide).
 * No nested ItemList — kept minimal to avoid per-listing validation risk.
 */
export function regionCollectionPageSchema(
  regionSlug: string,
  regionName: string,
  listingCount: number,
) {
  const plural = (verticalConfig as { listingNounPlural?: string; listingNoun?: string }).listingNounPlural ?? "listings";
  const singular = (verticalConfig as { listingNoun?: string }).listingNoun ?? plural;
  const noun = listingCount === 1 ? singular : plural;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${plural} in ${regionName}`,
    url: `${SITE_URL}/${regionSlug}`,
    description: `Browse ${listingCount} ${noun} in ${regionName}.`,
  };
}


// Static branded social card (public/og-default.png, 1200x630). Emitted
// UNCONDITIONALLY on detail pages — deliberately NOT gated on a hero image, so
// coverage is 100% rather than "whichever rows happen to have photos". Relative
// path; metadataBase (app/layout.tsx) resolves it to an absolute URL.
export const OG_DEFAULT_IMAGE = "/og-default.png";

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * FAQPage JSON-LD from a {question, answer}[] — the SAME shape app/costs emits.
 * Content is passed in verbatim (from verticalConfig.faqs, optionally with a
 * localized QUESTION via localizeFaqs); this helper never edits text, so the
 * schema is a 1:1 mirror of whatever the visible accordion renders.
 */
export function faqPageSchema(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/**
 * Interpolate a page's location into the QUESTION only, and only where it reads
 * naturally — pricing ("...cost?"), licensing requirement ("Do I need..."), and
 * DIY-legality ("Can I do my own...") questions. Definitional / safety questions
 * stay generic. ANSWERS are returned byte-for-byte unchanged: a place is NEVER
 * injected into a price, code, or licensing claim (no fabricated local figures).
 * Returns the same array (same order) so the caller renders the visible accordion
 * and the FAQPage schema from ONE localized array — keeping them 1:1.
 */
export function localizeFaqs(faqs: FaqItem[], location?: string | null): FaqItem[] {
  const loc = (location || "").trim();
  if (!loc) return faqs;
  return faqs.map((f) => {
    const q = f.question.toLowerCase();
    const placeScoped =
      q.includes("cost") || q.includes("do i need") || q.includes("can i do my own");
    if (!placeScoped) return f;
    // Answer untouched; only the question gains " in {loc}" before its trailing "?".
    return { question: f.question.replace(/\?\s*$/, ` in ${loc}?`), answer: f.answer };
  });
}

/**
 * BreadcrumbList for detail pages. Accepts an ordered trail of {name, path}
 * (Home → region hub → city hub → business); the CALLER drops any level whose hub
 * does not 200 — notably the CA province level (`/on` 404s, no region hub) — so the
 * emitted trail never carries a broken URL. Paths are canonical lowercase and the
 * last item is the listing's own canonical URL. Mirrors regionBreadcrumbSchema's
 * shape + SITE_URL derivation (Home item = bare SITE_URL, as there).
 */
export function detailBreadcrumbSchema(trail: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: t.path === "/" ? SITE_URL : canonicalUrl(t.path),
    })),
  };
}
