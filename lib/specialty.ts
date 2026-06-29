// Physician specialty ↔ NUCC taxonomy mapping for UI surfaces (TDL #806).
//
// Specialty membership is derived from `physician_listings.derived_taxonomy`
// (NUCC code, ~91.6% populated), NOT the legacy `listing_type` column
// (~0.09% populated — effectively dead; reading it left the SearchBar filter,
// the /directory listing_type filter, and the ListingCard badge all blank).
//
// This table is the SINGLE in-app mirror of the DB RPCs
// `physician_specialty_counts()` / `physician_specialty_listings(p_slug)` and
// `therapist-reclassify/phase2d-migration/07-tile-prefix-map.md`. First-match-wins,
// most-specific prefix first (cardiology breaks out of internal medicine — Option A).
// Keep these branches in sync with the RPC CASE branches.

export interface TilePrefix {
  slug: string;
  // POSIX-regex prefix, anchored at start, tested against one NUCC code.
  re: RegExp;
  // Same pattern in string form — value for the PostgREST `match` (~) operator.
  pattern: string;
}

// Ordered, first-match-wins — exactly the RPC ordering.
export const TILE_PREFIXES: TilePrefix[] = [
  { slug: "cardiologist",       re: /^207RC/,      pattern: "^207RC" },
  { slug: "internal-medicine",  re: /^207R/,       pattern: "^207R" }, // excl. ^207RC via first-match
  { slug: "family-medicine",    re: /^207Q/,       pattern: "^207Q" },
  { slug: "obgyn",              re: /^207V/,       pattern: "^207V" },
  { slug: "orthopedic-surgeon", re: /^207X/,       pattern: "^207X" },
  { slug: "pediatrician",       re: /^2080/,       pattern: "^2080" },
  { slug: "neurologist",        re: /^2084(N|F)/,  pattern: "^2084(N|F)" },
  { slug: "general-surgeon",    re: /^208600000X/, pattern: "^208600000X" },
];

// derived_taxonomy code → tile slug (first-match-wins), or null if no tile.
export function tileSlugForTaxonomy(code?: string | null): string | null {
  if (!code) return null;
  for (const t of TILE_PREFIXES) {
    if (t.re.test(code)) return t.slug;
  }
  return null;
}

// Tile slug → PostgREST regex filter for derived_taxonomy.
// `exclude` is set only for internal-medicine, which must not also capture the
// more-specific cardiology prefix (mirrors the RPC's `derived_taxonomy !~ '^207RC'`).
export function taxonomyFilterForSlug(
  slug: string
): { include: string; exclude?: string } | null {
  const tile = TILE_PREFIXES.find((t) => t.slug === slug);
  if (!tile) return null;
  if (slug === "internal-medicine") return { include: tile.pattern, exclude: "^207RC" };
  return { include: tile.pattern };
}
