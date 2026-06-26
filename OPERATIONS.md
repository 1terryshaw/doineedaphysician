# OPERATIONS — DoINeedAPhysician.com

## Health
`GET /api/health` → `{ status, checks{supabase,cost_models,env_vars}, vertical, tablePrefix,
listingCount, costModelCount }`. Pre-data-load it returns status "degraded" because
`cost_models` is EMPTY and `listingCount` is 0 — both expected until Phase 2d / §8A seeding.

## Data
- Tables: `physician_listings`, `physician_inquiries` (single empire Supabase project).
- After any bulk write (Phase 2d), refresh:
  `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_physician_listings_regions;`
  `REFRESH MATERIALIZED VIEW mv_physician_listings_cities;`
  (Caution: CONCURRENTLY on the shared project can spike CPU — schedule off-peak, cf. #543.)
- NEVER write generated columns: business_name, province, tier_priority, name_sortkey.

## Claims / Inquiries
- Claim + lead email via Resend / Gmail SMTP. Owner cookie: `physician_owner_token`.
- Removal requests: respond within 7 business days (per /disclaimer).

## Legal (NON-NEGOTIABLE)
- `app/disclaimer/page.tsx`, `components/EmergencyBanner.tsx`, listing-detail license notice —
  do not modify without legal sign-off.

## Local run
`npm run start` (use `PORT=3100` if other empire repos hold :3000).
