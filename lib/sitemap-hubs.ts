// SITEMAP HUB / CITY URL DERIVATION — empty-city-hubs-fan-v1 (2026-09-07). See K200.
//
// WHY. The sitemap emitted (a) every verticalConfig.regions slug unconditionally — 60
// of them Canadian city hubs on a corpus with ZERO CA rows, plus 13 Canadian province
// hubs that are equally empty — and (b) a city block hard-filtered to
// `.eq("country","CA")`, which on this 100%-US corpus yielded NOTHING. So ~1,900 real
// (province_state, city) pages that DO serve were never advertised, while 73 empty
// hubs were.
//
// THE RULE: a URL is advertised only if the ROUTE THAT SERVES IT returns a populated
// 200. Every predicate below mirrors a real read:
//
//   /{region}       app/[region]/page.tsx -> getListingsByProvincePaged(province)
//                   province_state = REGIONS[].province      [404s when empty]
//   /{PROV}/{city}  app/[region]/[city]/page.tsx -> getListingsByCity()
//                   province_state = PROV
//                   AND (region_slug = slug OR city ILIKE slug-with-spaces
//                        OR city ILIKE slug)
//                   (that route 404s on zero listings, so an empty pair is never
//                    advertised)
//
// If either read predicate changes, THIS FILE MUST CHANGE WITH IT — they are one
// contract, and a drift shows up as sitemap ∩ 404 > 0.
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";

// Matches lib/supabase.ts PAGE_SIZE — the whole corpus in a couple of round trips.
const PAGE = 50_000;

interface HubRow {
  province_state: string | null;
  region_slug: string | null;
  city: string | null;
}

export function slugifyCityName(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export interface SitemapHubs {
  /** REGIONS slugs whose hub read returns > 0 rows, as `/{slug}` paths. */
  regionPaths: string[];
  /** Real city pages, as `/{province_state}/{city-slug}` paths. */
  cityPaths: string[];
}

export async function getSitemapHubs(): Promise<SitemapHubs> {
  // Explicit range pagination — PostgREST caps an unpaginated select, and a silently
  // truncated occupancy set would DROP live city pages from the sitemap at HTTP 200.
  const rows: HubRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("province_state, region_slug, city")
      .in("country", ["CA", "US"])
      .neq("is_published", false)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    // FAIL-CLOSED: the caller turns this throw into a 503 rather than serving a
    // silently-shrunk sitemap at 200.
    if (error) {
      throw new Error(
        `sitemap hub query failed at offset ${from}: ${(error as { message?: string })?.message ?? "unknown"}`
      );
    }
    const page = (data ?? []) as HubRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  const provinceOccupied = new Set<string>(); // province_state (upper)
  const citiesByProvince = new Map<string, Set<string>>(); // prov -> lower(city)
  const slugsByProvince = new Map<string, Set<string>>(); // prov -> region_slug

  for (const r of rows) {
    const prov = r.province_state ? String(r.province_state).toUpperCase() : "";
    if (!prov) continue;
    provinceOccupied.add(prov);
    if (r.region_slug) {
      let s = slugsByProvince.get(prov);
      if (!s) slugsByProvince.set(prov, (s = new Set()));
      s.add(String(r.region_slug));
    }
    if (r.city && String(r.city).trim()) {
      let c = citiesByProvince.get(prov);
      if (!c) citiesByProvince.set(prov, (c = new Set()));
      c.add(String(r.city).trim().toLowerCase());
    }
  }

  const regionPaths = verticalConfig.regions
    .filter((region) => provinceOccupied.has(String(region.province).toUpperCase()))
    .map((region) => `/${region.slug}`);

  // City pages. Candidates come from the corpus itself; each is kept only if the
  // OR-predicate would actually match a live row in that province.
  const seen = new Set<string>();
  const cityPaths: string[] = [];
  for (const r of rows) {
    const prov = r.province_state ? String(r.province_state).toUpperCase() : "";
    if (!prov || !r.city || !String(r.city).trim()) continue;
    const slug = slugifyCityName(String(r.city));
    if (!slug) continue;
    // Province-as-city guard, mirrored from the city route.
    if (slug.toLowerCase() === prov.toLowerCase()) continue;
    const key = `${prov}/${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cities = citiesByProvince.get(prov);
    const slugs = slugsByProvince.get(prov);
    const servable =
      (cities?.has(slug.replace(/-/g, " ")) ?? false) ||
      (cities?.has(slug) ?? false) ||
      (slugs?.has(slug) ?? false);
    if (servable) cityPaths.push(`/${key}`);
  }
  cityPaths.sort();

  return { regionPaths, cityPaths };
}
