-- CampgroundsNearMe.ca — Supabase table setup
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS camp_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  short_description text,
  phone text,
  email text,
  website text,
  city text,
  province_state text,
  country text DEFAULT 'CA',
  region text,
  type text,
  owner_auth_token text,
  owner_email text,
  claimed boolean DEFAULT false,
  featured boolean DEFAULT false,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_tier text,
  google_rating numeric,
  google_review_count integer,
  photo_urls text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS camp_inquiries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES camp_listings(id),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_camp_listings_region ON camp_listings(region);
CREATE INDEX IF NOT EXISTS idx_camp_listings_type ON camp_listings(type);
CREATE INDEX IF NOT EXISTS idx_camp_listings_slug ON camp_listings(slug);
CREATE INDEX IF NOT EXISTS idx_camp_listings_featured ON camp_listings(featured);
CREATE INDEX IF NOT EXISTS idx_camp_inquiries_listing ON camp_inquiries(listing_id);

-- RLS policies
ALTER TABLE camp_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE camp_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON camp_listings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON camp_inquiries FOR SELECT USING (true);
CREATE POLICY "Service role full access listings" ON camp_listings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access inquiries" ON camp_inquiries FOR ALL USING (auth.role() = 'service_role');
