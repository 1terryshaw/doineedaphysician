-- setup-fresh.sql — DoINeedAPhysician.com schema bootstrap (Phase 2c)
-- Single empire Supabase project (msqiynbhoeruqctaesqk), SAME project as ther_listings.
-- Idempotent where practical. Run once at vertical creation. (Already applied 2026-06-26.)
--
-- physician_listings is an EXACT mirror of ther_listings so Phase 2d is a trivial INSERT…SELECT.

-- 1) Register the vertical (hmac_secret is NOT NULL — generate a real secret; do not reuse).
INSERT INTO empire_verticals (vertical_slug, display_name, primary_domain, listings_table, hmac_secret, name_col, status)
VALUES ('physicians','Physicians','doineedaphysician.com','physician_listings', encode(gen_random_bytes(32),'hex'), 'business_name','active')
ON CONFLICT (vertical_slug) DO NOTHING;

-- 2) Listings table = exact mirror of ther_listings (columns, generated cols, defaults, indexes).
CREATE TABLE IF NOT EXISTS physician_listings (LIKE ther_listings INCLUDING ALL);
ALTER TABLE physician_listings ENABLE ROW LEVEL SECURITY;
-- RLS: public read, service_role full access (mirrors ther_listings).
DROP POLICY IF EXISTS "Public read physician_listings" ON physician_listings;
CREATE POLICY "Public read physician_listings" ON physician_listings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role full access physician_listings" ON physician_listings;
CREATE POLICY "Service role full access physician_listings" ON physician_listings
  USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

-- 3) Inquiries table (contact/lead form), mirror + FK + RLS (anon insert, service full).
CREATE TABLE IF NOT EXISTS physician_inquiries (LIKE ther_inquiries INCLUDING ALL);
ALTER TABLE physician_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert physician_inquiries" ON physician_inquiries;
CREATE POLICY "Public insert physician_inquiries" ON physician_inquiries FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access physician_inquiries" ON physician_inquiries;
CREATE POLICY "Service role full access physician_inquiries" ON physician_inquiries
  USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));
-- (FK added once; guarded so re-runs don't error.)
DO $$ BEGIN
  ALTER TABLE physician_inquiries ADD CONSTRAINT physician_inquiries_listing_id_fkey
    FOREIGN KEY (listing_id) REFERENCES physician_listings(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Materialized views read by the app (lib/supabase.ts: mv_${table}_regions / _cities).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_physician_listings_regions AS
  SELECT country, province_state, count(*) AS n FROM physician_listings
  WHERE (country = ANY (ARRAY['CA','US'])) AND is_published IS DISTINCT FROM false AND province_state IS NOT NULL
  GROUP BY country, province_state;
CREATE UNIQUE INDEX IF NOT EXISTS mv_physician_listings_regions_pk
  ON mv_physician_listings_regions (country, province_state);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_physician_listings_cities AS
  SELECT DISTINCT country, province_state, city FROM physician_listings
  WHERE country IS NOT NULL AND province_state IS NOT NULL AND city IS NOT NULL AND city <> '';

-- After Phase 2d data load, refresh both:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_physician_listings_regions;
--   REFRESH MATERIALIZED VIEW mv_physician_listings_cities;
