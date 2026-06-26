import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";
import { getSpecialtyCounts, getSpecialtyListings, Listing } from "@/lib/supabase";
import ListingCard from "@/components/ListingCard";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

function tileFor(slug: string) {
  return verticalConfig.categoryLabels.find((c) => c.slug === slug) ?? null;
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const tile = tileFor(params.slug);
  if (!tile) return { title: "Specialty not found" };
  const title = `${tile.label}s — Find a ${tile.label} Near You`;
  return {
    title,
    description: `Browse a public directory of physicians listed under ${tile.label.toLowerCase()}. ${tile.description}. Not a medical referral service — see our disclaimer.`,
    alternates: { canonical: `/specialty/${tile.slug}` },
  };
}

export default async function SpecialtyPage({ params }: { params: { slug: string } }) {
  const tile = tileFor(params.slug);
  if (!tile) notFound();

  const [counts, listings] = await Promise.all([
    getSpecialtyCounts(),
    getSpecialtyListings(tile.slug),
  ]);
  const total = counts[tile.slug] ?? 0;
  const inferredCount = listings.filter((l) => l.taxonomy_source === "nppes_name").length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-1.5">/</span>
        <Link href="/directory" className="hover:underline">Directory</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">{tile.label}</span>
      </nav>

      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl">{tile.emoji}</span>
        <h1 className="text-3xl font-bold text-gray-900">{tile.label}</h1>
      </div>
      <p className="text-gray-600 mb-1">{tile.description}.</p>
      <p className="text-sm text-gray-500 mb-8">
        Browsing {tile.label} —{" "}
        <span className="font-medium text-gray-700">{fmt(total)}</span>{" "}
        {total === 1 ? "physician" : "physicians"} indexed.{" "}
        <Link
          href={`/directory?listing_type=${tile.slug}`}
          className="text-[#3B82F6] hover:underline font-medium"
        >
          View all physicians &rarr;
        </Link>
      </p>

      {listings.length === 0 ? (
        // Empty-state — never a dead end (degrades to the full directory).
        <div className="bg-gray-50 border rounded-xl p-10 text-center">
          <p className="text-gray-700 font-medium mb-2">
            No {tile.label.toLowerCase()} listings are indexed yet.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Our {tile.label.toLowerCase()} index is still being built. You can browse
            the full physician directory in the meantime.
          </p>
          <Link
            href={`/directory?listing_type=${tile.slug}`}
            className="inline-block px-6 py-3 rounded-lg font-semibold text-white"
            style={{ backgroundColor: verticalConfig.ctaColor }}
          >
            View all physicians &rarr;
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((l: Listing) => (
              <div key={l.id} className="relative">
                <ListingCard listing={l} />
                {l.taxonomy_source === "nppes_name" && (
                  <span
                    title="Specialty inferred by matching this listing's name to public NPPES provider records. Verify directly with the physician's office or the relevant state medical board."
                    className="absolute bottom-3 right-4 text-[10px] italic text-gray-400 cursor-help"
                  >
                    specialty inferred &#9432;
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Confidence-tier footnote (honest, not alarming). */}
          {inferredCount > 0 && (
            <p className="text-xs text-gray-400 mt-8 leading-relaxed max-w-3xl">
              Some listings marked &ldquo;specialty inferred&rdquo; were classified by
              matching the listing name to public NPPES provider records rather than a
              direct license identifier, and appear lower in the list. Specialty
              designations are not board certification. Always verify a physician&rsquo;s
              specialty and current license directly with the relevant state medical board.
            </p>
          )}
        </>
      )}
    </div>
  );
}
