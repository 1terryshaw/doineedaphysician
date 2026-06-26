# DoINeedAPhysician.com — PROGRESS

## Phase 2c — EMPTY SITE SPIN-UP  ✅ (2026-06-26)
Empty physician directory shipped from the doineedatherapist.org template.
**Public indexing GATED on disclaimer/TOS sign-off + human review of the live empty site.**

- DB (single empire project): `empire_verticals` row `physicians`; `physician_listings`
  (LIKE ther_listings INCLUDING ALL, RLS, 0 rows); `physician_inquiries`; MVs
  `mv_physician_listings_regions` + `_cities`. See `sql/setup-fresh.sql`.
- Rebrand: `lib/vertical.config.ts` → physician (specialties, FAQs, US default, tablePrefix
  physician_). Triage quiz REMOVED (`triageEnabled:false`). Learn page → physician specialties.
- Disclaimers (NON-NEGOTIABLE): `app/disclaimer/page.tsx` (full verbatim, 911 line), emergency
  banner on every page, listing-detail license notice, footer link, JSON-LD Physician type.
- Favicon: `public/favicon.svg` (medical cross, green).
- Build: `npm run build` exit 0. Local smoke (PORT=3100): title DoINeedAPhysician.com, H1 "Find a
  Physician Near You", emergency banner present, /disclaimer 911 line present, /api/health 200
  listingCount 0 (status "degraded" only because cost_models intentionally empty).

## Phase 2d — DATA MIGRATION  ⛔ NOT STARTED (gated)
- Move ~179K physicians from ther_listings → physician_listings:
  `source='ca_dca_medicalboard_2026_05_19'` (176,973) + NPPES `derived_taxonomy` 207/208/2084P
  (~2,263). INSERT…SELECT (never insert generated cols), de-dup on npi/slug, then REFRESH MVs.
- /costs cost_models seed for physicians: deferred (scaffold §8A human approval).
- Gate: human reviews the LIVE empty site + /disclaimer + emergency banner, signs off on
  disclaimer/TOS, THEN approves the data move.
