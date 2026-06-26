# DoINeedATherapist.org — v7 Directory Stamp

## Tech Stack
- Next.js 14.2.35, TypeScript, Tailwind CSS
- Supabase (database + storage) — instance: msqiynbhoeruqctaesqk
- Stripe (payments)
- Nodemailer (Gmail SMTP)

## Architecture
Config-driven directory template. One file change (`lib/vertical.config.ts`) to launch a new vertical.

## v7 Features
- 3-question triage quiz (NOT AI chat) for mental health check-in
- Cross-referral sidebar linking to related health directories
- Crisis resources (988 Suicide & Crisis Lifeline, Crisis Text Line 686868)
- Mental health safety: crisis resources always shown for high scores, disclaimer everywhere

## Database
- Table prefix: `ther_`
- Tables: `ther_listings`, `ther_inquiries`
- Filter columns: `listing_type` (NOT `type`), `region_slug` (NOT `region`)

## Domain Rules
- NEVER use www in NEXT_PUBLIC_BASE_URL
- NEVER set Domain attribute on cookies (let browser default to request origin)
- NO middleware.js/ts — it interferes with cookie handling on Vercel
- Cookie name derives from table prefix: `${tablePrefix}owner_token`

## All Data-Fetching Pages MUST Have
```typescript
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
```

## Auth Pattern (BottomlessPowder-proven)
- setAuthCookie() uses response.cookies.set() on NextResponse — NOT cookieStore.set()
- Auth route: validate token → NextResponse.redirect() with cookie set on response
- Verify route: await cookies() → parse → check Supabase
- Cookie format: slug:token (no encoding, colon is safe per RFC 6265)

## Key Files
- `lib/vertical.config.ts` — central config (name, domain, tablePrefix, colors, triage quiz, crisis resources, cross-referrals, FAQs)
- `lib/constants.ts` — regions and listing types (derived from verticalConfig)
- `lib/auth.ts` — cookie auth (BottomlessPowder pattern)
- `lib/supabase.ts` — database client and helpers
- `lib/pricing.ts` — Stripe tier definitions
- `lib/email.ts` — Gmail SMTP via Nodemailer
- `components/TriageQuizWidget.tsx` — 3-question mental health check-in widget

## Empire Pricing
- Claimed (free) → Reviews Plus ($9/mo) → Website ($29/mo) → Growth ($97/mo)

## Email
- Gmail SMTP via Nodemailer

## Mental Health Safety — NON-NEGOTIABLE
- High score results MUST always show crisis resources (988 call + text, Crisis Text Line 686868)
- Q1 "In crisis" shows resources IMMEDIATELY
- NEVER minimize distress
- NEVER diagnose ("you may have depression")
- DO use: "Based on what you shared, talking to a professional could help"
- Disclaimer on EVERY page
- Crisis resources link in footer on EVERY page

## Development
```bash
npm install
npm run dev     # Start dev server
npm run build   # Production build
npm run lint    # Lint check
```
