// site-flip-version: 2026-05-12-empire-sweep
import { createClient } from "@supabase/supabase-js";
import verticalConfig from "@/lib/vertical.config";
import { taxonomyFilterForSlug } from "@/lib/specialty";

// BUG-S1 (audit 2026-07-02): PostgREST's .or() grammar treats , ( ) as structural,
// so a raw search term containing them fails the whole filter with PGRST100 and the
// page renders 0 results. Values must be double-quoted, with embedded \ and "
// backslash-escaped. Returns a ready-to-interpolate quoted %term% pattern.
export function sanitizeOrTerm(raw: string): string {
  const escaped = raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, { ...options, cache: "no-store" });
    },
  },
});

// PostgREST caps unranged queries at 1000 rows. Loop .range() in 50000-row pages
// to fetch the full result set. Factory pattern is required because Supabase
// query builders cannot be reused after await.
const PAGE_SIZE = 50_000;
const HARD_CAP = 500_000;

async function paginateAll<T>(
  queryFactory: () => PromiseLike<{ data: T[] | null; error: unknown }>,
  options: { maxRows?: number; failClosed?: boolean } = {}
): Promise<T[]> {
  const upper = options.maxRows ?? HARD_CAP;
  const all: T[] = [];
  let from = 0;
  while (from < upper) {
    const to = Math.min(from + PAGE_SIZE - 1, upper - 1);
    const builder = queryFactory() as unknown as {
      range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
    };
    const { data, error } = await builder.range(from, to);
    if (error) {
      console.error("paginateAll error:", error);
      // FAIL-CLOSED (P1 2026-07-13): sitemap-feeding callers pass failClosed and MUST throw.
      // Returning `all` here yields a PARTIAL/EMPTY result that the caller renders as a
      // well-formed <urlset> at HTTP 200 — which instructs Google to de-index the chunk.
      // A throw becomes a 5xx: Google retries and keeps the last good sitemap.
      if (options.failClosed) {
        throw new Error(
          `paginateAll failed after ${all.length} rows: ${(error as { message?: string })?.message ?? "unknown"}`
        );
      }
      return all;
    }
    const page = data || [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// User-facing pages cap their listing fetch — sitemap goes via getListingsRange.
const USER_PAGE_MAX_ROWS = 200;

// TDL #661 — region pages paginate at this size (numbered pagination).
export const REGION_PAGE_SIZE = 48;


// Table names derived from config prefix
export const LISTINGS_TABLE = `${verticalConfig.tablePrefix}listings`;
export const INQUIRIES_TABLE = `${verticalConfig.tablePrefix}inquiries`;

export interface Listing {
  id: string;
  slug: string;
  name: string;
  description: string;
  short_description?: string;
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  province_state?: string;
  country?: string;
  region_slug?: string;
  listing_type?: string;
  owner_auth_token?: string;
  owner_email?: string;
  owner_name?: string;
  claimed: boolean;
  is_claimed?: boolean;
  claim_verified?: boolean;
  claimed_at?: string;
  featured: boolean;
  now_hiring?: boolean;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_tier?: string;
  tier?: string;
  tier_activated_at?: string;
  tier_priority?: number;
  siteforge_url?: string;
  siteforge_status?: string;
  custom_domain?: string;
  payment_error_review?: boolean;
  google_rating?: number;
  google_review_count?: number;
  photo_urls?: string[];
  // Phase 2d — taxonomy reclassification provenance.
  derived_taxonomy?: string;
  // 'nppes_npi' = NPI-authoritative (full confidence), 'nppes_name' = name-matched
  // to NPPES (lower confidence — render "specialty inferred" indicator), NULL =
  // honest unknown (never surfaced on /specialty pages).
  taxonomy_source?: string;
  derived_at?: string;
  created_at: string;
  updated_at?: string;
}

export async function getListings(regionSlug?: string): Promise<Listing[]> {
  return paginateAll<Listing>(() => {
    let query = supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("*")
      .in("country", ["CA", "US"])
      .neq("is_published", false)
      .order("tier_priority", { ascending: false, nullsFirst: false })
      .order("featured", { ascending: false, nullsFirst: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("name_sortkey", { ascending: true }).order("id", { ascending: true }).limit(200);

    if (regionSlug) {
      query = query.eq("region_slug", regionSlug);
    }

    return query as unknown as PromiseLike<{ data: Listing[] | null; error: unknown }>;
  }, { maxRows: USER_PAGE_MAX_ROWS });
}

export interface ListingFilters {
  q?: string;
  listing_type?: string;
  region?: string;
  city?: string;
  page?: number;
  perPage?: number;
}

// TDL #661 — the /directory text/specialty search view. Returns ONE page of
// results (default 48) via .range() instead of the old hard 200-row cap, so
// results beyond 200 are reachable with ?page=N. Fetches perPage+1 rows so the
// caller can tell whether a next page exists without an extra count query.
export async function getFilteredListings(filters: ListingFilters): Promise<Listing[]> {
  const perPage = filters.perPage ?? REGION_PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * perPage;
  const to = from + perPage; // inclusive end → fetches perPage+1 (look-ahead row)

  let query = supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .in("country", ["CA", "US"])
    .neq("is_published", false)
    .order("tier_priority", { ascending: false, nullsFirst: false })
    .order("featured", { ascending: false, nullsFirst: false })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .order("name_sortkey", { ascending: true }).order("id", { ascending: true });
  {
    // FIX-EMPIRE-CASCADING-SWEEP: cascading dropdowns send
    // ?region=<PROVINCE_CODE>&city=<city_slug>. Legacy single-param shapes
    // preserved as deprecated fallbacks.
    if (filters.region) {
      const r = filters.region.trim();
      if (filters.city) {
        const provCode = r.toUpperCase();
        const c = filters.city.trim();
        const cityText = c.replace(/-/g, " ");
        query = query
          .eq("province_state", provCode)
          .or(
            `region_slug.eq.${c},region_slug.eq.${c}-${provCode.toLowerCase()},city.ilike.${cityText},city.ilike.${c}`
          );
      } else if (/^[a-z]{2}$/i.test(r)) {
        query = query.eq("province_state", r.toUpperCase());
      } else {
        const suffixMatch = r.match(/^(.+)-([a-z]{2})$/i);
        if (suffixMatch) {
          const [, cityBase, prov] = suffixMatch;
          const cityText = cityBase.replace(/-/g, " ");
          query = query
            .eq("province_state", prov.toUpperCase())
            .or(
              `region_slug.eq.${r},region_slug.eq.${cityBase},city.ilike.${cityText},city.ilike.${cityBase}`
            );
        } else {
          const cityText = r.replace(/-/g, " ");
          query = query.or(
            `region_slug.eq.${r},city.ilike.${cityText},city.ilike.${r}`
          );
        }
      }
    }
    if (filters.listing_type) {
      // TDL #806 — resolve the specialty param against derived_taxonomy (NUCC,
      // ~91.6% populated) via the shared prefix map, NOT the dead listing_type
      // column (~0.09%). internal-medicine also excludes the more-specific
      // cardiology prefix (first-match-wins, mirrors the RPC).
      const tax = taxonomyFilterForSlug(filters.listing_type);
      if (tax) {
        query = query.filter("derived_taxonomy", "match", tax.include);
        if (tax.exclude) query = query.not("derived_taxonomy", "match", tax.exclude);
      } else {
        // Unknown slug (not a known tile) — legacy fallback to the old column.
        query = query.eq("listing_type", filters.listing_type);
      }
    }
    if (filters.q) {
      const term = sanitizeOrTerm(filters.q);
      query = query.or(
        `name.ilike.${term},city.ilike.${term}`
      );
    }
  }

  const { data, error } = await query.range(from, to);
  if (error) {
    console.error("getFilteredListings error:", error);
    return [];
  }
  return data || [];
}

// TDL #661 — per-province listing counts for the /directory region hub, served
// from the mv_${table}_regions matview (~tens of rows, <1ms) instead of a live
// GROUP BY over the full table. 5-min in-memory cache.
export interface RegionCount {
  country: string;
  province_state: string;
  n: number;
}

let _regionCountsCache: { ts: number; data: RegionCount[] } | null = null;
const REGION_COUNTS_TTL_MS = 5 * 60 * 1000;

export async function getRegionCounts(): Promise<RegionCount[]> {
  if (_regionCountsCache && Date.now() - _regionCountsCache.ts < REGION_COUNTS_TTL_MS) {
    return _regionCountsCache.data;
  }
  const { data, error } = await supabaseAdmin
    .from(`mv_${LISTINGS_TABLE}_regions`)
    .select("country, province_state, n");
  if (error) {
    console.error("getRegionCounts error:", error);
    return _regionCountsCache?.data ?? [];
  }
  const rows = (data || []).map((r) => ({
    country: String(r.country),
    province_state: String(r.province_state),
    n: Number(r.n) || 0,
  }));
  _regionCountsCache = { ts: Date.now(), data: rows };
  return rows;
}

export async function getRegionTotal(provinceCode: string): Promise<number> {
  const code = provinceCode.toUpperCase();
  const counts = await getRegionCounts();
  return counts.find((c) => c.province_state === code)?.n ?? 0;
}

// TDL #661 — one page of a province's listings, ordered to EXACTLY match
// idx_${table}_province_sort (province_state, tier_priority DESC NULLS LAST,
// featured DESC, google_rating DESC NULLS LAST, name) so deep pagination stays a
// ~1ms index scan. Do NOT add name_sortkey/id tiebreakers: they fall outside the
// index and turn large provinces into a full-province sort on every page load.
export async function getListingsByProvincePaged(
  provinceCode: string,
  page: number,
  perPage: number = REGION_PAGE_SIZE,
): Promise<Listing[]> {
  const p = Math.max(1, page);
  const from = (p - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .in("country", ["CA", "US"])
    .neq("is_published", false)
    .eq("province_state", provinceCode.toUpperCase())
    .order("tier_priority", { ascending: false, nullsFirst: false })
    .order("featured", { ascending: false })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })
    .range(from, to);
  if (error) {
    console.error(`getListingsByProvincePaged(${provinceCode}) error:`, error);
    return [];
  }
  return data || [];
}


export async function getListingsByCity(provinceCode: string, citySlug: string): Promise<Listing[]> {
  return paginateAll<Listing>(() => {
    const query = supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("*")
      .in("country", ["CA", "US"])
      .neq("is_published", false)
      .eq("province_state", provinceCode.toUpperCase())
      .or(`region_slug.eq.${citySlug},city.ilike.${citySlug.replace(/-/g, " ")},city.ilike.${citySlug}`) // TDL #317 city-page predicate
      .order("tier_priority", { ascending: false, nullsFirst: false })
      .order("featured", { ascending: false, nullsFirst: false })
      .order("google_rating", { ascending: false, nullsFirst: false })
      .order("name_sortkey", { ascending: true }).order("id", { ascending: true }).limit(200);
    return query as unknown as PromiseLike<{ data: Listing[] | null; error: unknown }>;
  }, { maxRows: USER_PAGE_MAX_ROWS });
}

export async function getListing(slug: string): Promise<Listing | null> {
  const { data, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .in("country", ["CA", "US"])
    .neq("is_published", false)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching listing "${slug}" from ${LISTINGS_TABLE}:`, error);
    // TDL #994: THROW, never `return null` on a DB failure. PostgREST's .single() reports
    // zero rows AS AN ERROR (PGRST116), so `error -> null` conflated "query failed" with
    // "listing does not exist" — and the caller turns null into notFound(). A transient
    // statement timeout therefore served a hard 404 for a LIVE listing, telling Google the
    // page was GONE. .maybeSingle() above gives 0 rows as {data:null,error:null}, so a
    // genuine miss still returns null (=> 404, unchanged) and only real failures throw.
    throw new Error(`getListing failed (${slug}): ${error.message || "unknown"}`);
  }

  if (!data) return null; // genuine not-found
  return data;
}

// FIX-EMPIRE-CASCADING-SWEEP — runtime regions backing cascading dropdowns.
// DISTINCT (province_state, city) filtered to canonical 64 codes. 5-min cache.
export interface DirectoryRegion {
  slug: string;
  name: string;
  province: string;
}

const CANONICAL_PROVINCE_CODES = [
  "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT",
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

// TDL #685: defensive guard against street-address / ZIP values polluting the
// `city` column. Conservative — only patterns that can NEVER be a real city:
//   • starts with a digit  • unit/suite/floor/box token  • "#<n>"
function looksLikeAddress(city: string): boolean {
  if (/^\s*\d/.test(city)) return true;
  if (/\b(unit|suite|ste|apt|floor|fl\.|building|bldg|rr#|p\.?o\.? box)\b/i.test(city)) return true;
  if (/#\s*\d/.test(city)) return true;
  return false;
}

function slugifyCityName(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function titleCaseCity(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

let _directoryRegionsCache: { ts: number; data: DirectoryRegion[] } | null = null;
const DIRECTORY_REGIONS_TTL_MS = 5 * 60 * 1000;

export async function getDirectoryRegions(): Promise<DirectoryRegion[]> {
  if (_directoryRegionsCache && Date.now() - _directoryRegionsCache.ts < DIRECTORY_REGIONS_TTL_MS) {
    return _directoryRegionsCache.data;
  }

  const rows = await paginateAll<{ province_state: string | null; city: string | null }>(() => {
    return supabaseAdmin
      .from(`mv_${LISTINGS_TABLE}_cities`)
      .select("province_state, city")
      .in("country", ["CA", "US"])
      .in("province_state", CANONICAL_PROVINCE_CODES)
      .not("city", "is", null)
      .neq("city", "") as unknown as PromiseLike<{
        data: { province_state: string | null; city: string | null }[] | null;
        error: unknown;
      }>;
  });

  const seen = new Map<string, { name: string; province: string }>();
  for (const r of rows) {
    if (!r.city || !r.province_state) continue;
    const cleaned = r.city.trim();
    if (!cleaned) continue;
    if (looksLikeAddress(cleaned)) continue; // TDL #685 — drop address/ZIP pollution
    const baseSlug = slugifyCityName(cleaned);
    if (!baseSlug) continue;
    const key = `${r.province_state}::${baseSlug}`;
    if (!seen.has(key)) {
      const name = cleaned === cleaned.toLowerCase() ? titleCaseCity(cleaned) : cleaned;
      seen.set(key, { name, province: r.province_state });
    }
  }

  const slugProvinces = new Map<string, Set<string>>();
  Array.from(seen.keys()).forEach((key) => {
    const [prov, baseSlug] = key.split("::");
    if (!slugProvinces.has(baseSlug)) slugProvinces.set(baseSlug, new Set());
    slugProvinces.get(baseSlug)!.add(prov);
  });

  const out: DirectoryRegion[] = [];
  Array.from(seen.entries()).forEach(([key, val]) => {
    const [, baseSlug] = key.split("::");
    const slug =
      (slugProvinces.get(baseSlug)?.size ?? 0) > 1
        ? `${baseSlug}-${val.province.toLowerCase()}`
        : baseSlug;
    out.push({ slug, name: val.name, province: val.province });
  });

  out.sort(
    (a, b) =>
      a.province.localeCompare(b.province) || a.name.localeCompare(b.name)
  );

  _directoryRegionsCache = { ts: Date.now(), data: out };
  return out;
}


// Uncapped variant of getListings for sitemap generation. Calls paginateAll
// without any maxRows option and with no per-page .limit() so the full result
// set (up to HARD_CAP) is returned. Sitemaps must enumerate every listing URL;
// user-facing /directory pages use the capped getListings instead.
export async function getAllListingsForSitemap(regionSlug?: string): Promise<Listing[]> {
  return paginateAll<Listing>(() => {
    let query = supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("*")
      .in("country", ["CA", "US"]).neq("is_published", false);
    if (regionSlug) {
      query = query.eq("region_slug", regionSlug);
    }
    return query as unknown as PromiseLike<{ data: Listing[] | null; error: unknown }>;
  }, { failClosed: true });
}

// Sitemap row shape — only the fields the chunk renderer needs.
// Narrow type avoids fetching 80-col `select("*")` payloads (~2KB/row → 88MB/chunk),
// which on 1M+ row tables (e.g. physician_listings) hit Vercel response-size limits.
export type SitemapListing = { slug: string; updated_at?: string; created_at: string };

// Bounded range fetch for sitemap chunks. Loops .range() in PAGE_SIZE pages
// from offset to offset+limit-1 so each chunk only pulls the rows it emits.
// ORDER BY id (PK index) — multi-column ORDER BY hits 8s statement_timeout
// on tables >~500K rows.
export async function getListingsRange(offset: number, limit: number): Promise<SitemapListing[]> {
  if (limit <= 0) return [];
  const all: SitemapListing[] = [];
  const end = offset + limit; // exclusive
  let from = offset;
  while (from < end) {
    const to = Math.min(from + PAGE_SIZE, end) - 1;
    const { data, error } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("slug,updated_at,created_at")
      .in("country", ["CA", "US"])
      .neq("is_published", false)
      .order("id", { ascending: true })
      .range(from, to);
    if (error) {
      console.error("getListingsRange error:", error);
      // FAIL-CLOSED (P1 2026-07-13): never return a partial page — see paginateAll.
      throw new Error(
        `getListingsRange failed after ${all.length} rows: ${(error as { message?: string })?.message ?? "unknown"}`
      );
    }
    const page = data || [];
    all.push(...page);
    const requested = to - from + 1;
    if (page.length < requested) break; // ran past end of dataset
    from = to + 1;
  }
  // FAIL-CLOSED (P1 2026-07-13): 0 rows is only legitimate PAST THE END of the corpus.
  // The sitemap index is SIZED from getListingsCount(), so a chunk whose offset falls
  // inside that count MUST yield rows. Serving it as an empty <urlset> at HTTP 200 is
  // what tells Google the chunk has no URLs. A genuinely out-of-range chunk (offset >=
  // total) is still allowed to render empty — that is a real, legitimately-empty tail.
  if (all.length === 0) {
    const total = await getListingsCount();
    if (offset < total) {
      throw new Error(
        `getListingsRange(${offset}, ${limit}) returned 0 rows but the corpus holds ${total} — refusing to serve an empty sitemap chunk`
      );
    }
  }
  return all;
}

// Phase 2d — /specialty/<slug> support. Specialty membership is derived from
// derived_taxonomy (NUCC codes) via two STABLE SQL RPCs that keep the
// first-match-wins prefix map (07-tile-prefix-map.md) in ONE place in the DB:
//   physician_specialty_counts()        → per-tile published counts
//   physician_specialty_listings(slug)  → published rows for one tile, ordered
//     nppes_npi-first then tier/featured/rating. Rows with NULL taxonomy_source
//     (honest unknown) and NULL derived_taxonomy are excluded by both RPCs.

// Canonical Section-A tiles (slug → label/emoji/description). Single source of
// truth for the homepage tile grid, /specialty validation, and /specialty copy.
// Order matches the approved Section-A spec. Cardiology breaks out of internal
// medicine (Option A); psychiatry/dermatology are intentionally NOT tiles.
export interface SpecialtyTile {
  slug: string;
  label: string;
  emoji: string;
  description: string;
}

export async function getSpecialtyCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.rpc("physician_specialty_counts");
  if (error) {
    console.error("getSpecialtyCounts error:", error);
    return {};
  }
  const out: Record<string, number> = {};
  for (const r of (data as { slug: string; n: number }[] | null) || []) {
    out[String(r.slug)] = Number(r.n) || 0;
  }
  return out;
}

export async function getSpecialtyListings(slug: string): Promise<Listing[]> {
  const { data, error } = await supabaseAdmin.rpc("physician_specialty_listings", {
    p_slug: slug,
  });
  if (error) {
    console.error(`getSpecialtyListings(${slug}) error:`, error);
    return [];
  }
  return (data as Listing[] | null) || [];
}

// HEAD-only count query for sitemap chunk planning. Avoids fetching row data.
export async function getListingsCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*", { count: "exact", head: true })
    .in("country", ["CA", "US"]).neq("is_published", false);
  if (error) {
    // FAIL-CLOSED (P1 2026-07-13): returning 0 made the sitemap INDEX advertise 1 chunk
    // (or none) during a transient DB error — silently shrinking the sitemap.
    console.error("Error counting listings:", error);
    throw new Error(
      `getListingsCount failed: ${(error as { message?: string })?.message ?? "unknown"}`
    );
  }
  return count || 0;
}
