import verticalConfig from "@/lib/vertical.config";
import { getListingsCount } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const CHUNK_SIZE = 40_000;
const STATIC_PATH_COUNT = 6;

async function renderSitemap() {
  const baseUrl = `https://${verticalConfig.domain}`;

  const listingCount = await getListingsCount();
  const headers =
    STATIC_PATH_COUNT +
    verticalConfig.categoryLabels.length +
    verticalConfig.regions.length;
  const firstChunkListingCapacity = Math.max(0, CHUNK_SIZE - headers);
  const remainingListings = Math.max(0, listingCount - firstChunkListingCapacity);
  const remainingChunks = Math.ceil(remainingListings / CHUNK_SIZE);
  const totalChunks = 1 + remainingChunks;
  const lastmod = new Date().toISOString();

  const sitemaps = Array.from({ length: totalChunks }, (_, i) =>
    `  <sitemap><loc>${baseUrl}/sitemap/${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

// FAIL-CLOSED SITEMAP (P1 2026-07-13) ------------------------------------------------
// A sitemap must NEVER serve a partial or empty result at HTTP 200. A well-formed
// but EMPTY <urlset> at 200 tells Google "this chunk has no URLs" and de-indexes it;
// a 5xx tells Google "temporary" so it retries and KEEPS the previous sitemap.
// Every data helper below throws on error (see lib/supabase.ts); this boundary turns
// any such throw into a real 503 instead of a silently-degraded 200.
export async function GET(
  ...args: Parameters<typeof renderSitemap>
): Promise<Response> {
  try {
    return await renderSitemap(...args);
  } catch (err) {
    console.error("[sitemap] FAIL-CLOSED 503 — refusing to serve a partial/empty sitemap:", err);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- sitemap temporarily unavailable; retry -->`,
      {
        status: 503,
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "no-store",
          "Retry-After": "600",
        },
      }
    );
  }
}
