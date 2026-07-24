import verticalConfig from "@/lib/vertical.config";
import { getListingsRange, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const CHUNK_SIZE = 40_000;

const STATIC_ENTRIES: { path: string; changefreq: string; priority: string }[] = [
  { path: "", changefreq: "daily", priority: "1.0" },
  { path: "/directory", changefreq: "daily", priority: "0.9" },
  { path: "/pricing", changefreq: "weekly", priority: "0.7" },
  { path: "/terms", changefreq: "monthly", priority: "0.3" },
  { path: "/privacy", changefreq: "monthly", priority: "0.3" },
  { path: "/learn", changefreq: "weekly", priority: "0.7" },
];

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
  const headers =
    STATIC_ENTRIES.length +
    verticalConfig.categoryLabels.length +
    verticalConfig.regions.length;
  const firstChunkListingCapacity = Math.max(0, CHUNK_SIZE - headers);

  const offset =
    id === 0 ? 0 : firstChunkListingCapacity + (id - 1) * CHUNK_SIZE;
  const limit = id === 0 ? firstChunkListingCapacity : CHUNK_SIZE;

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
    for (const region of verticalConfig.regions) {
      parts.push(urlEntry(`${baseUrl}/${region.slug}`, now, "daily", "0.8"));
    }
    // City pages (/{PROV}/{city}) — CA only. F-α.3 sweep.
    // Inline distinct query: ~50-150 pairs per repo, well below chunk capacity.
    const { data: cityRows, error: cityRowsError } = await supabaseAdmin
      .from("physician_listings")
      .select("province_state, region_slug")
      .eq("country", "CA")
      .neq("is_published", false)
      .not("province_state", "is", null)
      .not("region_slug", "is", null)
      .limit(1000000);
    // FAIL-CLOSED (P1 2026-07-13): this query had NO error check — on failure it
    // silently dropped these URLs from the chunk and still returned HTTP 200.
    if (cityRowsError) {
      throw new Error(
        `sitemap cityRows query failed: ${(cityRowsError as { message?: string })?.message ?? "unknown"}`
      );
    }
    const seenCity = new Set<string>();
    const cityPairs: Array<{ province_state: string; region_slug: string }> = [];
    for (const row of cityRows ?? []) {
      const key = `${row.province_state}/${row.region_slug}`;
      if (seenCity.has(key)) continue;
      seenCity.add(key);
      cityPairs.push(row as { province_state: string; region_slug: string });
    }
    for (const c of cityPairs) {
      parts.push(urlEntry(`${baseUrl}/${c.province_state}/${c.region_slug}`, now, "weekly", "0.7"));
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
