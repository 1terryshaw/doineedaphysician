import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getListingsByCity } from "@/lib/supabase";
import { getCityBySlug, CITIES, PROVINCES } from "@/lib/constants";
import ListingCard from "@/components/ListingCard";
import verticalConfig from "@/lib/vertical.config";
import ShareButtons from "@/components/pizzazz/ShareButtons";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ region: string; city: string }>;
}

export async function generateStaticParams() {
  return CITIES.map((city) => ({
    region: city.province,
    city: city.slug,
  }));
}

// C5 OR-gate (6B-v2): derive a readable city name when the (province, slug) pair
// is not in CITIES. Prefer the listing row's city; else slug-derive (strip a
// trailing -<province> suffix, then title-case). e.g. "london-on" -> "London".
function deriveCityName(region: string, citySlug: string, rowCity?: string | null): string {
  if (rowCity && rowCity.trim()) return rowCity.trim();
  let s = citySlug;
  const suffix = `-${region.toLowerCase()}`;
  if (s.toLowerCase().endsWith(suffix)) s = s.slice(0, -suffix.length);
  return s
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, city } = await params;
  const cityData = getCityBySlug(region, city);
  const cityName = cityData?.name ?? deriveCityName(region, city);
  const provinceName = PROVINCES[region.toUpperCase()] ?? region;
  return {
    title: `Professionals in ${cityName}, ${provinceName}`,
    description: `Find professionals in ${cityName}, ${provinceName}. Browse our directory of trusted professionals.`,
    alternates: { canonical: `/${region}/${city}` },
  };
}

export default async function CityPage({ params }: Props) {
  const { region, city } = await params;
  // P2 guard: province-as-city (e.g. /QC/qc) is not a real city.
  if (city.toLowerCase() === region.toLowerCase()) notFound();

  const cityData = getCityBySlug(region, city);
  const listings = await getListingsByCity(region, city);
  // OR-gate: render if the pair is in CITIES OR has DB listings; else 404.
  if (!cityData && listings.length === 0) notFound();

  const cityName = cityData?.name ?? deriveCityName(region, city, listings[0]?.city);
  const provinceName = PROVINCES[region.toUpperCase()] ?? region;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">
        Professionals in {cityName}
      </h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title={`${verticalConfig.name} — Directory`} />
      </div>
      <p className="text-gray-600 mb-8">
        Browse {listings.length} {listings.length === 1 ? "professional" : "professionals"} in {cityName}, {provinceName}.
      </p>

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No professionals in {cityName} yet. Check back soon!
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
