# DoINeedATherapist.org — Full v7 Directory Build

## API KEYS — ASK UPFRONT
Before starting any work, list ALL API keys and secrets you'll need for this session. Ask for them in a single message so Terry only has to respond once. Do not ask for keys one at a time during the build.

## CONTEXT
This is a full directory stamp based on campgroundsnearme.ca with the stamper v6 template overlay. The vertical.config.ts is already in lib/ with therapist categories, national regions, 3-question triage quiz config, crisis resources, cross-referrals, and FAQs. Supabase tables (ther_listings, ther_inquiries) already exist.

This is Stamper v7 — it includes fixes from the v6 dentist build:
- All data-fetching pages MUST have `export const dynamic = 'force-dynamic'` and `export const fetchCache = 'force-no-store'`
- Filter queries use `listing_type` column (NOT `type`)
- Filter queries use `region_slug` column (NOT `region`)
- Chat/triage widget scrolls INSIDE its container (never scrolls the page)
- Minimal whitespace between hero and triage widget

## DO NOT TOUCH THESE FILES — THEY ARE ALREADY CORRECT:
- next.config.js
- postcss.config.js
- tailwind.config.js (or tailwind.config.ts)
- lib/pricing.ts
- lib/email.ts
- lib/auth.ts
- lib/supabase.ts
- lib/useOwnerAuth.ts
- components/Header.tsx
- components/PricingTable.tsx
- app/api/owner/login/route.ts
- app/api/owner/me/route.ts
- app/api/owner/logout/route.ts

## STRICT VERIFICATION PROTOCOL:
1) READ each file before modifying
2) Start dev server (`npx next dev`)
3) Test every endpoint with curl — paste full response
4) If error, fix and retest. Do NOT commit until working.
5) Run `git status`, `git diff --name-only`
6) Commit, push, show hash
7) VERIFY push landed: `git log --oneline origin/master -1` — confirm your commit hash matches

## PRE-FLIGHT CHECK:
1) Confirm ther_listings table exists in Supabase
2) Confirm all required env vars are set
3) Report any failures before writing code

## IMPORTANT:
- Never commit .env files. Verify .gitignore contains `.env`, `.env.local`, `.env.production`, `.env*.local`
- Work on master branch
- Write .env templates to .env.example
- Google Places API: LEGACY only (maps.googleapis.com/maps/api/place/)

---

## TASK 1: Homepage — 3-Question Triage Quiz + Category Grid + City Grid

This is the KEY DIFFERENCE from dentist. Instead of a free-form AI chat, the homepage has a structured 3-question triage quiz that routes users to the directory.

### Design
- Warm, approachable, NOT clinical
- Colors from verticalConfig: sage green (#6B8F71), warm coral CTA (#E17055), cream backgrounds (#FFF8F0)
- Mobile-first
- Soft shadows, rounded corners, generous whitespace

### Hero Section
- Headline: "Not sure if you should talk to someone?"
- Subheadline: "Take this free, private 2-minute check-in — no signup required"
- TWO buttons: "Start Check-In →" (coral, primary) and "Browse Therapists" (outline)
- Minimal gap between hero and quiz widget (8px MAX)

### Triage Quiz Widget (components/TriageQuizWidget.tsx)
- Reads questions from verticalConfig.triageQuestions
- Shows one question at a time
- Progress bar: "Question 1 of 3"
- Answer options as large clickable cards (not small radio buttons)
- Back button on Q2 and Q3
- Skip button on every question (defaults score to 2)
- CRITICAL: If Q1 answer has `crisis: true`, show crisis resources from verticalConfig.crisisResources IMMEDIATELY — do not wait for results
- After Q3, show city selection: text input + quick-select chips for major cities (Toronto, Vancouver, Calgary, Montreal, Ottawa, Edmonton, Winnipeg, Halifax)
- Then show results

### Results (inline, not a separate page)
- Calculate total score from Q1 + Q2 (Q3 determines therapist type)
- Score 2-3: Show verticalConfig.triageResults.low
- Score 4-6: Show verticalConfig.triageResults.moderate
- Score 7-8: Show verticalConfig.triageResults.high + crisis resources box (ALWAYS)
- CTA button: "Find a {type} in {city} →" linking to /directory?listing_type={type-slug}&region={city-slug}
- Cross-referral section: "You might also benefit from:" with links from verticalConfig.crossReferrals
- Disclaimer from verticalConfig.triageDisclaimer always visible

### CRITICAL Mental Health Safety Rules — NON-NEGOTIABLE:
1. High score results MUST always show crisis resources (988 call + text, Crisis Text Line 686868)
2. Q1 "In crisis" shows resources IMMEDIATELY
3. NEVER minimize distress
4. NEVER diagnose ("you may have depression")
5. DO use: "Based on what you shared, talking to a professional could help"
6. Disclaimer on EVERY page
7. Crisis resources link in footer on EVERY page

### Quiz widget scrolling
- Quiz widget has max-height with overflow-y-auto
- Scrolls INSIDE the widget container
- NEVER use window.scrollTo or scrollIntoView on anything outside the quiz
- Use ref on container: `containerRef.current.scrollTop = containerRef.current.scrollHeight`

### Category/Specialty Grid
- Section heading: "Types of Therapists"
- Grid of specialties from verticalConfig.categoryLabels
- Each card: emoji + label + short description
- Links to /directory?listing_type={slug}
- Responsive: 2 cols mobile, 3 cols tablet, 5 cols desktop

### National City Grid (grouped by province)
- Section heading: "Find a Therapist Near You"
- Group cities by province using verticalConfig.provinceLabels
- Each city links to /directory?region={slug}

### FAQ Section
- Accordion from verticalConfig.faqs
- Clean expand/collapse

---

## TASK 2: /api/health Endpoint

Create app/api/health/route.ts:
- GET endpoint, no auth
- Checks: Supabase connection (SELECT count(*) from ther_listings), env vars present
- Returns: { status, checks, vertical, tablePrefix, listingCount, timestamp }

---

## TASK 3: Directory Page

Update /directory page:
- MUST have `export const dynamic = 'force-dynamic'` and `export const fetchCache = 'force-no-store'` at top
- Page title: "Find a Therapist"
- Search bar: "Search therapists by name..."
- Filter dropdowns: Specialty (from categoryLabels), Region/City (from regions grouped by province)
- IMPORTANT: filters query `listing_type` column (NOT `type`) and `region_slug` column (NOT `region`)
- Listing cards: name, specialty badge, city/province, Google rating, phone, "View Details"
- Empty state: "No therapists found matching your criteria. Try broadening your search."
- Warm green color scheme matching homepage

---

## TASK 4: Listing Detail Page

Update /directory/[slug] page:
- MUST have `export const dynamic = 'force-dynamic'` and `export const fetchCache = 'force-no-store'`
- Show: name, specialty, description, city/province, phone, email, website, Google rating, reviews
- Photo gallery if photo_urls exist
- Inquiry form → /api/inquiries
- Claim CTA if not claimed
- Badges: Claimed, Pro, Premium
- Cross-referral sidebar: "You might also need:" from verticalConfig.crossReferrals
- Schema.org structured data: @type "MedicalBusiness" or "ProfessionalService"

---

## TASK 5: Region Page

Update /[region] page:
- MUST have `export const dynamic = 'force-dynamic'` and `export const fetchCache = 'force-no-store'`
- No generateStaticParams (incompatible with force-dynamic)
- Shows listings filtered by region_slug
- Title: "Therapists in {city}"

---

## TASK 6: Terms + Privacy

Update for:
- Company: "Smart Website Management"
- Service: "DoINeedATherapist.org therapist directory and mental health check-in tool"
- Contact: hello@doineedatherapist.org
- Additional clause: "The check-in tool is not a clinical assessment. No answers are stored."
- Crisis resources mentioned in privacy page

---

## TASK 7: Dynamic Sitemap

Create/update app/sitemap.ts:
- Homepage, /directory, /pricing, /terms, /privacy, /learn
- All region pages
- All listing detail pages (query ther_listings)

---

## TASK 8: Learn Page (NEW — v7)

Create app/learn/page.tsx:
- "Types of Therapy" informational page
- Brief descriptions (2-3 sentences each, warm tone, NOT clinical):
  - Talk therapy / psychotherapy
  - Cognitive Behavioral Therapy (CBT)
  - Couples counselling
  - Family therapy
  - EMDR / trauma therapy
  - Art & creative therapy
- CTA at bottom: "Find a therapist near you →"
- Linked from results page and footer

---

## TASK 9: Footer

Update Footer component:
- Links: Directory | Pricing | Learn About Therapy | Privacy | Crisis Resources
- Crisis resources link goes to a section or page showing 988 + Crisis Text Line
- Disclaimer text from verticalConfig.triageDisclaimer
- "Powered by DoINeedAPro.info" (small, gray)
- Cross-referral links from verticalConfig.crossReferrals

---

## TASK 10: .env.example + CLAUDE.md

Create .env.example:
```
# DoINeedATherapist.org — Environment Variables
# Vercel: https://vercel.com/1terryshaw/doineedatherapist/settings/environment-variables

# Supabase (shared empire instance)
NEXT_PUBLIC_SUPABASE_URL=PASTE_HERE
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_HERE
SUPABASE_SERVICE_ROLE_KEY=PASTE_HERE

# Base URL
NEXT_PUBLIC_BASE_URL=https://doineedatherapist.org

# Stripe (shared empire prices — CAD)
STRIPE_SECRET_KEY=PASTE_HERE
STRIPE_WEBHOOK_SECRET=PASTE_HERE

# Gmail SMTP
GMAIL_USER=PASTE_HERE
GMAIL_APP_PASSWORD=PASTE_HERE

# Google Places (for seeding — LEGACY API ONLY)
GOOGLE_PLACES_API_KEY=PASTE_HERE
```

Create CLAUDE.md:
- Project: DoINeedATherapist.org — v7 directory stamp
- Stack: Next.js 14, Supabase (msqiynbhoeruqctaesqk), Stripe, Vercel
- Table prefix: ther_
- v7 features: 3-question triage quiz (not AI chat), cross-referral sidebar, crisis resources
- Filter columns: listing_type (not type), region_slug (not region)
- All data pages: dynamic = 'force-dynamic', fetchCache = 'force-no-store'
- Mental health safety: crisis resources always shown for high scores, 988 lifeline, disclaimer everywhere
- Empire pricing: Claimed (free) → Pro ($29) → Premium ($49) → Growth ($97)
- Email: Gmail SMTP via nodemailer

---

## ACCEPTANCE TESTS — ALL MUST PASS:

1. Homepage: warm green design, hero → quiz with minimal gap
2. Triage quiz: 3 questions work, progress bar, back/skip buttons
3. Q1 "In crisis" → crisis resources shown IMMEDIATELY
4. Low score result → soft CTA
5. High score result → crisis box with 988 + Crisis Text Line
6. CTA links to /directory?listing_type={slug}&region={city-slug}
7. /directory shows listings (once seeded) with correct filters
8. /directory filters by listing_type and region_slug correctly
9. /directory/[slug] detail page renders
10. /learn page loads with therapy types
11. /pricing shows empire tiers with annual toggle
12. /api/health returns healthy status
13. /owner/login page loads
14. /terms and /privacy load with mental health disclaimers
15. Footer shows crisis resources link + disclaimer
16. Cross-referral links visible on listing pages
17. /sitemap.xml valid
18. Mobile responsive at 375px
19. `npx next build` passes with 0 errors
20. Commit, push, VERIFY with `git log --oneline origin/master -1`

## git tag working-v1 after successful build
