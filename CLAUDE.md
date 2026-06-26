# DoINeedAPhysician.com — Physician Directory (Phase 2c spin-up)

Public directory of licensed physicians. Spun up from the doineedatherapist.org template
(Directory Stamper v3 / scaffold-stamper-v14 conventions) for empire Phase 2c. **Empty site at
launch — physician data is migrated in Phase 2d (INSERT…SELECT from ther_listings).**

## Tech Stack
- Next.js 14.2.35, TypeScript, Tailwind CSS
- Supabase (single empire project `msqiynbhoeruqctaesqk` — SAME project as ther_listings)
- Stripe (payments), empire-billing handshake (HS256 BILLING_HMAC_SECRET)
- Resend + Gmail SMTP (claim / lead email)

## Data
- Vertical slug: `physicians` (row in `empire_verticals`)
- Table prefix: `physician_` → `physician_listings`, `physician_inquiries`
- `physician_listings` is an EXACT mirror of `ther_listings` (CREATE TABLE LIKE … INCLUDING ALL),
  so Phase 2d migration is a trivial INSERT…SELECT. Generated columns (NEVER INSERT):
  `business_name` (=name), `province` (=province_state), `tier_priority`, `name_sortkey`.
- Materialized views the app reads: `mv_physician_listings_regions`, `mv_physician_listings_cities`
  (REFRESH after Phase 2d data load).
- RLS: public SELECT, service_role full access (mirrors ther_listings).

## Data Sources (cite publicly — see /disclaimer)
- California Department of Consumer Affairs / Medical Board of California public licensee records
- National Plan and Provider Enumeration System (NPPES), CMS
- Additional state medical board public records
- Contains NO patient information / NO PHI.

## NON-NEGOTIABLES (medical vertical)
1. **Disclaimer page** — `app/disclaimer/page.tsx`. **DO NOT modify without legal sign-off.**
   Full verbatim text: not-a-referral, not-medical-advice, emergencies (911), accuracy,
   data sources, claims/corrections, specialty≠board-cert, no practitioner-patient relationship,
   limitation of liability, contact.
2. **Emergency banner** — `components/EmergencyBanner.tsx`, rendered in `app/layout.tsx` ABOVE the
   header on EVERY page ("Medical emergency? Call 911"). Do not remove/weaken.
3. **Listing-detail license notice** — `app/directory/[slug]/page.tsx` ("Verify license directly
   with the relevant state medical board").
4. **Footer disclaimer link** on every page (`components/Footer.tsx`).
5. **No symptom/diagnosis triage.** `triageEnabled: false` in `lib/vertical.config.ts` — a
   medical symptom quiz would be medical advice. TriageQuizWidget removed.
6. Standard build standards: favicon in `public/favicon.svg`, 'Other' last in dropdowns,
   JSON-LD (`["Physician","MedicalBusiness"]`) on listing pages, OG/Twitter meta, real meta
   description, email unsubscribe + List-Unsubscribe headers, `/api/health` 200 + count,
   mobile+desktop clean, Tailwind globs cover all TSX.

## Specialty Tiles & Confidence Tiers (Phase 2d Part 1)

The homepage has two tile sections, and `/specialty/<slug>` pages browse by specialty.

- **Section A — Browse by Specialty** (`verticalConfig.categoryLabels`, 8 internal tiles):
  Family Medicine, Internal Medicine, Pediatrician, OB/GYN, Cardiologist, Orthopedic
  Surgeon, Surgeon (general surgery only), Neurologist. Each links to
  `/specialty/<slug>`. Per-tile counts render **dynamically** from the
  `physician_specialty_counts()` RPC — never hardcoded.
  **Slug convention (Part 1.5):** practitioner form to match labels + search intent —
  `cardiologist`, `pediatrician`, `orthopedic-surgeon`, `general-surgeon`, `neurologist`,
  `obgyn`; `family-medicine` and `internal-medicine` keep specialty form (Option B —
  natural search terms). The slug strings live in `categoryLabels` (single source of
  truth) AND must match the `physician_specialty_*` RPC `CASE`/`WHEN p_slug=` branches. **Psychiatrist and
  Dermatologist are intentionally NOT Section-A tiles** (psychiatry 2084P* is
  excluded from the Phase 2d move; dermatology has its own directory → Section B).
- **Section B — Related specialists** (`verticalConfig.relatedSpecialists`, 4 external
  cards, `target=_blank rel=noopener`): Therapist → doineedatherapist.org,
  Dermatologist → doineedadermatologist.com, Chiropractor → doineedachiropractor.com,
  Optometrist → doineedanoptometrist.com.

**Specialty membership** is derived from `derived_taxonomy` (NUCC codes) via the
first-match-wins prefix map in `therapist-reclassify/phase2d-migration/07-tile-prefix-map.md`,
encoded **once** in two DB RPCs: `physician_specialty_counts()` and
`physician_specialty_listings(p_slug)`. Cardiology (`^207RC`) breaks out of internal
medicine (`^207R`) — Option A. Surgeon = `^208600000X` only.

**Confidence-tier rendering on `/specialty/<slug>`** (driven by `taxonomy_source`):
- `nppes_npi` (NPI-authoritative): **no badge**, sorted **first** (RPC ORDER BY
  `taxonomy_source='nppes_npi' DESC`).
- `nppes_name` (name-matched to NPPES, lower confidence): subtle muted italic
  `specialty inferred ⓘ` indicator on the card + a section footnote
  ("classified by matching the listing name to public NPPES records … verify with
  the state medical board"). Honest, not alarming. Sorted **after** nppes_npi rows.
- `taxonomy_source IS NULL` (honest unknown): **never appears** on `/specialty`
  pages — both RPCs filter `taxonomy_source IS NOT NULL` (and `derived_taxonomy IS NOT NULL`).
  These rows remain browsable via `/directory` and region/city pages.

Empty-state: when a tile has 0 indexed listings, `/specialty/<slug>` shows a friendly
"index still being built" panel that links to `/directory?listing_type=<slug>` — never a
404, never a dead end. (Pre-Part-2-move, all specialty counts read 0; that is expected.)

## Domain Rules
- NEVER use www in NEXT_PUBLIC_BASE_URL (`https://doineedaphysician.com`)
- NEVER set Domain attribute on cookies (browser defaults to request origin)
- NO middleware.js/ts (interferes with cookies on Vercel)
- Cookie name derives from table prefix: `physician_owner_token`
- Vercel domain attach: apex canonical + www alias, **status code 308** (UI default 307 is SEO-broken)

## All Data-Fetching Pages MUST Have
```typescript
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
```

## Key Files
- `lib/vertical.config.ts` — central config (branding, tablePrefix=physician_, specialties, FAQs,
  crossReferrals, triageEnabled=false, defaultCountry=US)
- `lib/supabase.ts` — data layer (LISTINGS_TABLE = `${tablePrefix}listings`)
- `lib/auth.ts` — cookie auth (BottomlessPowder pattern)
- `app/disclaimer/page.tsx` — legal disclaimer (gated)
- `components/EmergencyBanner.tsx` — 911 banner (every page)

## /costs Cost Estimator
Deferred. The therapist cost_models seed was removed; physician cost_models are NOT seeded.
Per scaffold §8A, seeding requires HUMAN APPROVAL of the service/range table before migrate.
`/api/health` reports `cost_models: EMPTY` until then (status "degraded" is expected pre-seed).

## Empire Pricing
Claimed (free) → Reviews Plus ($9/mo) → Website ($49/mo) → Growth ($97/mo)

## Development
```bash
npm install
npm run dev
npm run build
npm run start   # if :3000 is taken (other empire repos), use PORT=3100
```

## Phase status
- Phase 2c (this): EMPTY site + disclaimers. Public-indexing GATED on disclaimer/TOS sign-off.
- Phase 2d (NOT STARTED): migrate ~179K physician rows (ca_dca_medicalboard + NPPES 207/208/2084P)
  into physician_listings; then REFRESH the two MVs. Awaiting explicit human approval.
