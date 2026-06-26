import {
  CANONICAL_CITIES,
  PROVINCE_MAP,
  getCityBySlug as _getCityBySlug,
} from "./shared/cities";

import verticalConfig from "@/lib/vertical.config";
// Cities sourced from canonical shared list
export const CITIES = CANONICAL_CITIES.map((c) => ({
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
