# POST-BUILD — DoINeedAPhysician.com

Run after every production deploy.

1. `curl -sI https://doineedaphysician.com` → 200 + `x-vercel-id` header.
2. `curl -s https://doineedaphysician.com/api/health` → 200; `listingCount` matches DB; pre-Phase-2d it is 0.
3. `curl -s https://doineedaphysician.com/disclaimer | grep -i "call 911"` → match (emergency line).
4. Emergency banner visible on homepage (top of every page).
5. Homepage JSON-LD present (`grep -c application/ld+json` ≥ 1).
6. Favicon resolves: `curl -sI https://doineedaphysician.com/favicon.svg` → 200.
7. OG/Twitter meta present in homepage `<head>`.
8. Domains canonical: apex 200, `www` → 308 → apex (NOT 307).
9. No residual "therapist" in rendered HTML except intentional cross-referral links
   (Find a Therapist / Find a Physiotherapist).

## GATE
Do NOT begin Phase 2d data migration or remove the indexing gate until the human signs off on the
disclaimer/TOS and reviews the live empty site.
