# Cost Estimator — Progress (therapist)

Vertical-agnostic Cost Estimator module (v2, sweep standard) dropped in from the
dentist canary. Identity resolves from empire_verticals by listings_table.

## 2026-06-16 — sweep Batch 1, vertical 1 (therapist)
**Shipped:** `/costs` estimator, markets us + ca (USD/CAD). Session TYPES (not modalities).
- `sql/migrate-costcalc-therapist.sql` (idempotent; ADDS 10 rows to shared cost_models,
  vertical='therapist'; other verticals + global region_modifiers untouched).
  Services: individual / couples / family / group session + intake assessment.
- v2 module (built-in canonical region catalog, NOT verticalConfig.provinceLabels;
  CTA → /directory?region=<CODE>; a/an FAQ): lib/cost-models.ts, app/api/cost-estimate,
  app/costs/page.tsx, components/CostEstimator.tsx; app/api/health route adds cost_models check.
- **Verified LOCAL:** tsc clean; /api/health healthy, cost_models ok, count 10;
  US individual/PhD/NY = US$180–455 (per session); CA couples/In-person/ON = CA$125–275;
  /costs H1 + a/an FAQ ("an individual therapy session…") + US/Canada optgroups + Other last.
- **Verified PROD:** see commit/report (currency field present in prod payload).
