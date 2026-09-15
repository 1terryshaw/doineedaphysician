import verticalConfig from "@/lib/vertical.config";
import { getListingsCount, getListingsRange } from "@/lib/supabase";
import { getSitemapHubs } from "@/lib/sitemap-hubs";

/**
 * ── 🔴 ISR, AND NO 503 FALLBACK (2026-09-14, sitemap-cdn-sweep-v1; ref doineedamechanic 4aaddf8) ──
 * Prerendered and revalidated every 24h rather than rebuilt per request. This route was
 * `force-dynamic` + `revalidate = 0` + an explicit `max-age=0` header, so it was never cached at
 * all: `x-vercel-cache: MISS` on every fetch, including back-to-back ones, and every crawler hit
 * spent a function invocation on a full listings scan. The file changes at most once a day.
 *
 * The handler reads NOTHING from the request — no headers, no cookies, no searchParams; a chunk id
 * comes from the PATH PARAM only — which is what makes `force-static` legal here.
 *
 * `fetchCache = "force-no-store"` is GONE, and the sitemap data helpers moved to `supabaseRead`:
 * an explicit no-store fetch forces the whole route dynamic, so leaving either in place would have
 * made `force-static` a silent no-op. Unqualified fetches inherit the segment's `revalidate`, so
 * the inner reads refresh on the same 24h window as the route.
 *
 * A generation FAULT now LOGS AND RETHROWS instead of returning 503. Under ISR a throw leaves the
 * last good copy in place; the 503 replaced a correct sitemap with an error page for as long as
 * the fault lasted, and Search Console reads a 503 on a submitted sitemap as "couldn't fetch" — a
 * day of lost recrawl for what may be one bad connection. At BUILD time the same throw fails the
 * build, so a broken deployment never replaces a working one. A degraded 200 remains impossible:
 * the helpers still throw rather than return a partial result (P1 2026-07-13 preserved, only its
 * failure MODE changed).
 */
export const dynamic = "force-static";
export const revalidate = 86400;
export const maxDuration = 60;

// ── CHILD SPLIT (2026-09-14, sitemap-cdn-sweep-v1; ref doineedachiropractor 02e70d1 / doineedamechanic 4aaddf8) ──
// 45,000 → 5,000 URLs per child (~1.1 MB). This tree was shipping a child of 8.5 MB, and Google
// had registered none of it. MUST equal the sibling route's CHILD_SIZE: the index SIZES the
// children from it, so a disagreement slides every offset. `/sitemap/0.xml` stays the first child
// so nothing Google already queued 404s.
const CHILD_SIZE = 5_000;

const STATIC_ENTRIES: { path: string; changefreq: string; priority: string }[] = [
  { path: "", changefreq: "daily", priority: "1.0" },
  { path: "/directory", changefreq: "daily", priority: "0.9" },
  { path: "/pricing", changefreq: "weekly", priority: "0.7" },
  { path: "/terms", changefreq: "monthly", priority: "0.3" },
  { path: "/privacy", changefreq: "monthly", priority: "0.3" },
  { path: "/learn", changefreq: "weekly", priority: "0.7" },
];

// ── PRERENDER EVERY CHILD (2026-09-14, sitemap-cdn-sweep-v1) ──
// On-demand ISR of this dynamic segment does NOT hold on Vercel: the first generation caches, but
// every revalidated copy is stored already-stale — `x-vercel-cache: STALE` with `age` resetting on
// every request and a function hop each time. Measured across this fleet at 215 KB children and at
// 10 MB ones alike (K258/K260), so neither the body size nor any response header was the variable;
// the prerendered siblings hold as PRERENDER -> HIT with a climbing `age`. So: enumerate every child
// at BUILD, derived EXACTLY as the index derives its count. `dynamicParams` stays true, so a child
// the revalidated index later advertises beyond this list still renders rather than 404ing.
export async function generateStaticParams(): Promise<{ id: string }[]> {
  const { cityPaths, regionPaths } = await getSitemapHubs();
  const headers = STATIC_ENTRIES.length +
    verticalConfig.categoryLabels.length +
    regionPaths.length +
    cityPaths.length;
  const firstChunkListingCapacity = Math.max(0, CHILD_SIZE - headers);
  const remainingListings = Math.max(0, (await getListingsCount()) - firstChunkListingCapacity);
  const totalChunks = 1 + Math.ceil(remainingListings / CHILD_SIZE);
  return Array.from({ length: totalChunks }, (_, i) => ({ id: `${i}.xml` }));
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

async function renderSitemap(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const match = /^(\d+)\.xml$/.exec(params.id);
  if (!match) {
    return new Response("Not Found", { status: 404 });
  }
  const id = Number(match[1]);

  const baseUrl = `https://${verticalConfig.domain}`;
  // HUBS + CITY PAGES — empty-city-hubs-fan-v1 (2026-09-07). Derived by
  // lib/sitemap-hubs.ts, which mirrors the serving reads exactly. Counted into
  // `headers` because they occupy chunk 0: app/sitemap.xml computes the SAME number,
  // and if the two disagree the chunk offsets slide and listings drop or duplicate.
  const { regionPaths, cityPaths } = await getSitemapHubs();
  const headers =
    STATIC_ENTRIES.length +
    verticalConfig.categoryLabels.length +
    regionPaths.length +
    cityPaths.length;
  const firstChunkListingCapacity = Math.max(0, CHILD_SIZE - headers);

  const offset =
    id === 0 ? 0 : firstChunkListingCapacity + (id - 1) * CHILD_SIZE;
  const limit = id === 0 ? firstChunkListingCapacity : CHILD_SIZE;

  const listings = await getListingsRange(offset, limit);
  const now = new Date().toISOString();

  const parts: string[] = [];

  if (id === 0) {
    for (const e of STATIC_ENTRIES) {
      parts.push(urlEntry(`${baseUrl}${e.path}`, now, e.changefreq, e.priority));
    }
    // Specialty hub pages (/specialty/<slug>) — Part 1.5.
    for (const cat of verticalConfig.categoryLabels) {
      parts.push(urlEntry(`${baseUrl}/specialty/${cat.slug}`, now, "weekly", "0.7"));
    }
    for (const path of regionPaths) {
      parts.push(urlEntry(`${baseUrl}${path}`, now, "daily", "0.8"));
    }
    for (const path of cityPaths) {
      parts.push(urlEntry(`${baseUrl}${path}`, now, "weekly", "0.7"));
    }
  }

  for (const l of listings) {
    const raw = l.updated_at || l.created_at;
    const lastmod = raw ? new Date(raw).toISOString() : now;
    parts.push(urlEntry(`${baseUrl}/directory/${l.slug}`, lastmod, "weekly", "0.6"));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${parts.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      // No explicit Cache-Control (K257): with `revalidate = 86400` Next emits
      // `s-maxage=86400, stale-while-revalidate` itself. The old
      // `public, max-age=0, must-revalidate` OVERRODE that and left the CDN with
      // nothing to hold — x-vercel-cache: MISS on every fetch.
    },
  });
}

// A generation fault LOGS AND RETHROWS (see the ISR note at the top of this file). Under ISR that
// keeps the last good copy serving; the old 503 fallback replaced a correct sitemap with an error
// page, and Search Console reads a 503 on a submitted sitemap as "couldn't fetch". At build time
// the same throw fails the build. An empty/partial 200 stays impossible — the data helpers throw
// rather than returning a short result, which is the P1 2026-07-13 discipline, unchanged.
export async function GET(
  ...args: Parameters<typeof renderSitemap>
): Promise<Response> {
  try {
    return await renderSitemap(...args);
  } catch (err) {
    console.error("[sitemap] generation FAULT — rethrowing so ISR keeps the last good copy:", err);
    throw err;
  }
}
