import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import {
  getFilteredListings,
  getDirectoryRegions,
  getRegionCounts,
  getListingsCount,
  REGION_PAGE_SIZE,
  type DirectoryRegion,
} from "@/lib/supabase";
import {
  LISTING_TYPES,
  REGIONS,
  getRegionByProvinceCode,
  countryOfProvinceCode,
} from "@/lib/constants";
import ListingCard from "@/components/ListingCard";
import SearchBar from "@/components/SearchBar";
import Pagination from "@/components/Pagination";
import RegionHub, { type HubSection, type HubRegion } from "@/components/RegionHub";
import ShareButtons from "@/components/pizzazz/ShareButtons";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Find a Physician",
  description: `Browse all ${verticalConfig.entityPlural.toLowerCase()} in the ${verticalConfig.name} directory.`,
  alternates: { canonical: "/directory" },
};

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; search?: string; city?: string; s?: string; listing_type?: string; region?: string; page?: string }>;
}) {
  const params = await searchParams;
  const region = params.region || "";
  // FIX-EMPIRE-CASCADING-SWEEP — when `region` is present, `city` is the
  // cascading-dropdown filter (slug). When no region, legacy `?city=` stays
  // a free-text name search alias.
  const cityFilter = region ? params.city || "" : "";
  const q = params.q || params.search || params.s || (region ? "" : params.city || "");
  const listingType = params.listing_type || "";
  const hasFilters = !!(q || listingType || region || cityFilter);

  let runtimeRegions: DirectoryRegion[] = [];
  try {
    runtimeRegions = await getDirectoryRegions();
  } catch (err) {
    console.error("getDirectoryRegions failed; falling back to static REGIONS:", err);
  }

  // ── Default view (no filters): browse-by-region hub. ──────────────────────
  if (!hasFilters) {
    const [counts, total] = await Promise.all([getRegionCounts(), getListingsCount()]);
    const ca: HubRegion[] = [];
    const us: HubRegion[] = [];
    for (const c of counts) {
      const r = getRegionByProvinceCode(c.province_state);
      if (!r) continue;
      const entry: HubRegion = { slug: r.slug, name: r.name, count: c.n };
      (countryOfProvinceCode(c.province_state) === "CA" ? ca : us).push(entry);
    }
    const byName = (a: HubRegion, b: HubRegion) => a.name.localeCompare(b.name);
    ca.sort(byName);
    us.sort(byName);
    const sections: HubSection[] = [];
    if (us.length) sections.push({ country: "US", label: "🇺🇸 United States", regions: us });
    if (ca.length) sections.push({ country: "CA", label: "🇨🇦 Canada", regions: ca });

    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Find a Physician</h1>
        <div className="mb-4">
          <ShareButtons variant="compact" title={`Browse ${verticalConfig.name} Directory`} />
        </div>
        <div className="mb-6">
          <SearchBar variant="directory" regions={runtimeRegions.length > 0 ? runtimeRegions : undefined} />
        </div>
        <p className="text-gray-600 mb-8">
          {total.toLocaleString("en-US")} physicians in our directory. Choose a state or province to browse.
        </p>
        {sections.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No regions available yet. Check back soon!</p>
        ) : (
          <RegionHub sections={sections} />
        )}
      </div>
    );
  }

  // ── Filtered view: paginated results. ─────────────────────────────────────
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const fetched = await getFilteredListings({
    q,
    listing_type: listingType,
    region,
    city: cityFilter,
    page,
    perPage: REGION_PAGE_SIZE,
  });
  const hasNext = fetched.length > REGION_PAGE_SIZE;
  const listings = hasNext ? fetched.slice(0, REGION_PAGE_SIZE) : fetched;

  const typeName = listingType ? LISTING_TYPES.find((t) => t.slug === listingType)?.name : null;
  const provinceCode = region.toUpperCase();
  const regionPool = runtimeRegions.length > 0 ? runtimeRegions : REGIONS;
  const regionName = region
    ? (verticalConfig as { provinceLabels?: Record<string, string> }).provinceLabels?.[provinceCode] ||
      regionPool.find((r) => r.province.toUpperCase() === provinceCode)?.province ||
      regionPool.find((r) => r.slug === region)?.name ||
      region
    : null;
  const cityName = cityFilter
    ? regionPool.find(
        (r) =>
          r.province.toUpperCase() === provinceCode &&
          (r.slug === cityFilter || r.slug.startsWith(`${cityFilter}-`))
      )?.name || cityFilter
    : null;

  const pageParams: Record<string, string> = {};
  if (q) pageParams.q = q;
  if (listingType) pageParams.listing_type = listingType;
  if (region) pageParams.region = region;
  if (cityFilter) pageParams.city = cityFilter;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Find a Physician</h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title={`Browse ${verticalConfig.name} Directory`} />
      </div>

      <div className="mb-6">
        <SearchBar
          variant="directory"
          defaultQ={q}
          defaultType={listingType}
          defaultRegion={region}
          defaultCity={cityFilter}
          regions={runtimeRegions.length > 0 ? runtimeRegions : undefined}
        />
      </div>

      <p className="text-gray-600 mb-4">
        {listings.length === 0
          ? "No physicians"
          : `Page ${page} — ${listings.length} ${listings.length === 1 ? "physician" : "physicians"}`}
        {" matching your filters"}.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {q && (
          <Link
            href={`/directory?${new URLSearchParams({
              ...(listingType ? { listing_type: listingType } : {}),
              ...(region ? { region } : {}),
              ...(cityFilter ? { city: cityFilter } : {}),
            }).toString()}`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200"
          >
            Search: {q} <span aria-label="clear">&times;</span>
          </Link>
        )}
        {typeName && (
          <Link
            href={`/directory?${new URLSearchParams({
              ...(q ? { q } : {}),
              ...(region ? { region } : {}),
              ...(cityFilter ? { city: cityFilter } : {}),
            }).toString()}`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200"
          >
            Specialty: {typeName} <span aria-label="clear">&times;</span>
          </Link>
        )}
        {regionName && (
          <Link
            href={`/directory?${new URLSearchParams({
              ...(q ? { q } : {}),
              ...(listingType ? { listing_type: listingType } : {}),
            }).toString()}`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200"
          >
            Region: {regionName} <span aria-label="clear">&times;</span>
          </Link>
        )}
        {cityName && (
          <Link
            href={`/directory?${new URLSearchParams({
              ...(q ? { q } : {}),
              ...(listingType ? { listing_type: listingType } : {}),
              ...(region ? { region } : {}),
            }).toString()}`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200"
          >
            City: {cityName} <span aria-label="clear">&times;</span>
          </Link>
        )}
        <Link
          href="/directory"
          className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm hover:bg-gray-200"
        >
          Clear all
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No physicians found matching your criteria. Try broadening your search.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <Pagination currentPage={page} basePath="/directory" hasNext={hasNext} params={pageParams} />
        </>
      )}
    </div>
  );
}
