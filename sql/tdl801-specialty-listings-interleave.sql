-- TDL #801 — Physician /specialty RPC cap/order fix (SQL-only)
--
-- Problem: physician_specialty_listings(p_slug) ordered
--   (taxonomy_source='nppes_npi') DESC ... LIMIT 300
-- Every CA row is register-sourced (cpsa_register / cpsns_register), never
-- nppes_npi, so it sorts AFTER all US NPI rows. With 34,058 US NPI
-- cardiologists alone, the first 300 are 100% US and ALL 289 CA cardiologists
-- (the #796-recovered cohort) are unreachable. Same burial on every tile.
--
-- Fix: country-interleave. Rank rows WITHIN each country by the existing quality
-- order, then interleave (CA leads each rank pair) so neither country is buried,
-- and raise the cap to 600 so the full CA cohort of the verification tile
-- (cardiologist, 289) is reachable inside ~300 CA slots while US still gets ~300.
-- Window function used directly in ORDER BY → SELECT stays `*`, return type
-- (SETOF physician_listings) is preserved exactly. Counts RPC is untouched.
--
-- Note (out of scope, future): the 3 largest CA tiles (family-medicine 8,649,
-- internal-medicine 1,996, pediatrician 1,163) still truncate at ~300 CA slots;
-- full-cohort reach for those needs pagination on /specialty (a surface change).

CREATE OR REPLACE FUNCTION public.physician_specialty_listings(p_slug text)
  RETURNS SETOF physician_listings
  LANGUAGE sql
  STABLE
AS $function$
  SELECT * FROM physician_listings
  WHERE is_published AND derived_taxonomy IS NOT NULL AND taxonomy_source IS NOT NULL AND (
    (p_slug='cardiologist'        AND derived_taxonomy ~ '^207RC') OR
    (p_slug='internal-medicine'   AND derived_taxonomy ~ '^207R' AND derived_taxonomy !~ '^207RC') OR
    (p_slug='family-medicine'     AND derived_taxonomy ~ '^207Q') OR
    (p_slug='obgyn'               AND derived_taxonomy ~ '^207V') OR
    (p_slug='orthopedic-surgeon'  AND derived_taxonomy ~ '^207X') OR
    (p_slug='pediatrician'        AND derived_taxonomy ~ '^2080') OR
    (p_slug='neurologist'         AND derived_taxonomy ~ '^2084(N|F)') OR
    (p_slug='general-surgeon'     AND derived_taxonomy ~ '^208600000X')
  )
  ORDER BY
    row_number() OVER (
      PARTITION BY country
      ORDER BY (taxonomy_source='nppes_npi') DESC, tier_priority DESC NULLS LAST,
               featured DESC, google_rating DESC NULLS LAST, name
    ),
    (country='CA') DESC
  LIMIT 600;
$function$;
