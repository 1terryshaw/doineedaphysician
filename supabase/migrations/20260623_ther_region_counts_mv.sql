-- TDL #661 — region hub support (mirrors notary #657).
-- Per-province listing counts for the /directory region hub. Avoids a live
-- GROUP BY over ther_listings (1.7M rows) on every /directory load.
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ther_listings_regions;
-- The CONCURRENTLY form requires the UNIQUE index below.
DROP MATERIALIZED VIEW IF EXISTS mv_ther_listings_regions;
CREATE MATERIALIZED VIEW mv_ther_listings_regions AS
SELECT country, province_state, count(*)::bigint AS n
FROM ther_listings
WHERE country IN ('CA', 'US') AND is_published IS DISTINCT FROM false AND province_state IS NOT NULL
GROUP BY country, province_state;
CREATE UNIQUE INDEX IF NOT EXISTS mv_ther_listings_regions_pk ON mv_ther_listings_regions (country, province_state);

-- Region-page pagination fast path (province_state filter + standard ordering).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ther_listings_province_sort
  ON public.ther_listings USING btree
  (province_state, tier_priority DESC NULLS LAST, featured DESC, google_rating DESC NULLS LAST, name)
  WHERE (country = ANY (ARRAY['CA'::text, 'US'::text]));
