import { Metadata } from "next";
import { notFound } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import { getListingsByProvincePaged, getRegionTotal, REGION_PAGE_SIZE } from "@/lib/supabase";
import ListingCard from "@/components/ListingCard";
import Pagination from "@/components/Pagination";
import ShareButtons from "@/components/pizzazz/ShareButtons";
import { regionBreadcrumbSchema, regionCollectionPageSchema } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ region: string }>;
  searchParams: Promise<{ page?: string }>;
}

function getRegion(slug: string) {
  return verticalConfig.regions.find((r) => r.slug === slug) || null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { region } = await params;
  const { page: pageParam } = await searchParams;
  const regionData = getRegion(region);
  if (!regionData) return { title: "Not Found" };
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const canonical = page > 1 ? `/${region}?page=${page}` : `/${region}`;
  const pageSuffix = page > 1 ? ` (Page ${page})` : "";
  return {
    title: `Physicians in ${regionData.label}${pageSuffix}`,
    description: `Find trusted physicians in ${regionData.label}, ${regionData.province}. Browse verified listings on ${verticalConfig.name}.`,
    alternates: { canonical },
  };
}

export default async function RegionPage({ params, searchParams }: Props) {
  const { region } = await params;
  const { page: pageParam } = await searchParams;
  const regionData = getRegion(region);
  if (!regionData) notFound();

  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const [total, listings] = await Promise.all([
    getRegionTotal(regionData.province),
    getListingsByProvincePaged(regionData.province, page),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / REGION_PAGE_SIZE));

  // Out-of-range page → 404 rather than a confusing empty list. Page 1 always renders.
  if (page > 1 && listings.length === 0) notFound();

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(regionBreadcrumbSchema(region, regionData.label)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(regionCollectionPageSchema(region, regionData.label, total)) }} />
      <h1 className="text-3xl font-bold mb-2 text-gray-900">
        Physicians in {regionData.label}
      </h1>
      <div className="mb-4">
        <ShareButtons variant="compact" title={`${verticalConfig.name} — Directory`} />
      </div>
      <p className="text-gray-600 mb-8">
        Browse {total.toLocaleString("en-US")} {total === 1 ? "physician" : "physicians"} in{" "}
        {regionData.label},{" "}
        {verticalConfig.provinceLabels[regionData.province] || regionData.province}
        {totalPages > 1 ? ` — page ${page} of ${totalPages.toLocaleString("en-US")}` : ""}.
      </p>

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No physicians in {regionData.label} yet. Check back soon!
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <Pagination currentPage={page} basePath={`/${region}`} totalPages={totalPages} />
        </>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-12 text-center leading-relaxed">
        {verticalConfig.triageDisclaimer}
      </p>
    </div>
  );
}
