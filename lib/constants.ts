import {
  CANONICAL_CITIES,
  PROVINCE_MAP,
  getCityBySlug as _getCityBySlug,
} from "./shared/cities";

import { US_STATES } from "./provinces";

import verticalConfig from "@/lib/vertical.config";
// CITY TREE — empty-city-hubs-fan-v1 (F2, 2026-09-07). See K200.
//
// CANONICAL_CITIES is the shared CA-oriented list: 600 entries, every one of them in a
// Canadian province. physician_listings is 100% US (115,456 rows, zero CA), so those pairs only ever
// fed generateStaticParams with routes the zero-listing guard then 404s, and supplied
// display names for cities this corpus does not have. Filtering to the subdivisions this
// corpus actually serves retires all 600.
//
// Kept as a FILTER, not a hard-coded [], so a future CA seed repopulates it on its own.
// US city pages are unaffected: they never matched this list (it is 100% CA) and get
// their display name from deriveCityName()/the listing row.
const SERVED_PROVINCE_CODES = new Set(US_STATES.map((s) => s.code.toUpperCase()));

export const CITIES = CANONICAL_CITIES.filter((c) =>
  SERVED_PROVINCE_CODES.has(c.province.toUpperCase())
).map((c) => ({
  name: c.name,
  slug: c.slug,
  province: c.province,
}));



// Regions — derived from verticalConfig
export const REGIONS = verticalConfig.regions.map((r) => ({
  name: r.label,
  slug: r.slug,
  province: r.province,
}));

// TDL #661 — territories may be absent from verticalConfig.regions; ensure they
// exist so the region hub doesn't hide listings in NT/NU/YT.
for (const terr of [
  { name: "Northwest Territories", slug: "northwest-territories", province: "NT" },
  { name: "Nunavut", slug: "nunavut", province: "NU" },
  { name: "Yukon", slug: "yukon", province: "YT" },
]) {
  if (!REGIONS.some((r) => r.province === terr.province)) REGIONS.push(terr);
}

// Listing types/categories — derived from verticalConfig
export const LISTING_TYPES = verticalConfig.categoryLabels.map((c) => ({
  name: c.label,
  slug: c.slug,
  description: c.description,
  emoji: c.emoji,
}));

// Brand constants
export const BRAND = {
  siteName: verticalConfig.name,
  siteUrl: `https://${verticalConfig.domain}`,
  supportEmail: verticalConfig.supportEmail,
};

export function getRegionBySlug(slug: string) {
  return REGIONS.find((r) => r.slug === slug) || null;
}

// TDL #661 — map a province_state code (e.g. "TX","ON") back to its REGIONS entry
// for the region hub + SearchBar clean-link navigation.
export function getRegionByProvinceCode(code: string) {
  const c = code.toUpperCase();
  return REGIONS.find((r) => r.province === c) || null;
}

const CA_PROVINCE_CODES = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);
export function countryOfProvinceCode(code: string): "CA" | "US" {
  return CA_PROVINCE_CODES.has(code.toUpperCase()) ? "CA" : "US";
}

export function getListingTypeBySlug(slug: string) {
  return LISTING_TYPES.find((t) => t.slug === slug) || null;
}

export function getCityBySlug(provinceSlug: string, citySlug: string) {
  const province = provinceSlug.toUpperCase();
  const known = CITIES.find((c: any) => c.province === province && c.slug === citySlug);
  if (known) return known;
  // TDL #317 fallback v2: REGIONS slug match (shape-agnostic across vertical.config.ts variants).
  const region = REGIONS.find((r: any) => r.slug === provinceSlug);
  if (!region) return null;
  const name = citySlug
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
  return { name, slug: citySlug, province };
}

export const PROVINCES: Record<string, string> = PROVINCE_MAP;
