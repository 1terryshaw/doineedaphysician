# DEPLOY — DoINeedAPhysician.com

Empire single-Supabase Next.js vertical. Deploy from the laptop with Vercel CLI (PowerShell).

## 1. Environment variables (Vercel project → Settings → Environment Variables)
Copy from `.env.example`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GMAIL_USER`,
`GMAIL_APP_PASSWORD`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`, `BILLING_SERVICE_URL`,
`BILLING_VERTICAL_SLUG=physicians`, `BILLING_HMAC_SECRET` (MUST equal
`empire_verticals.hmac_secret` for vertical_slug='physicians').
Set for ALL environments. Also set:
```
NEXT_PUBLIC_BASE_URL=https://doineedaphysician.com   # NO www
NEXT_PUBLIC_SITE_URL=https://doineedaphysician.com
```

## 2. Deploy (laptop PowerShell)
```powershell
npx vercel link --yes
npx vercel pull --yes --environment=production
npx vercel --prod
```

## 3. Attach domains (set redirect status 308 — UI default 307 is SEO-broken)
Apex canonical, www as alias:
```powershell
npx vercel domains add doineedaphysician.com
npx vercel domains add www.doineedaphysician.com
```
(or use the empire attach helper at ~/empire/stampers/attach-domains-308.sh which forces 308).
DNS already set: A @ → 216.150.1.1, CNAME www → cname.vercel-dns.com.

## 4. Prod smoke
```powershell
curl.exe -sI https://doineedaphysician.com               # 200 + Vercel headers
curl.exe -s  https://doineedaphysician.com/disclaimer | findstr 911
curl.exe -s  https://doineedaphysician.com/api/health    # 200, listingCount 0
```

## GATE
Public indexing requires disclaimer/TOS sign-off. Do NOT run Phase 2d data migration until the
human reviews the live empty site and approves.
