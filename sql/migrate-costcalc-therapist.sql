-- migrate-costcalc-therapist.sql
-- Cost Estimator — ADD therapist rows to the SHARED cost_models table.
-- IDEMPOTENT + NON-DESTRUCTIVE: only UPSERTs vertical='therapist' rows. Does NOT
-- touch other verticals' rows, does NOT touch region_modifiers (global, reused).
-- Depends on the cost_models schema from the dentist migrations
-- (cost_models keyed (vertical, market, service); RLS service-role-only).
--
-- Markets: us (USD) + ca (CAD). Services are SESSION TYPES (not modalities).
-- Cash-pay per-session/visit pricing. Complexity = delivery mode where it matters.

INSERT INTO public.cost_models
  (vertical, market, service, service_label, base_low, base_high, unit, complexity_options, sort_order, notes)
VALUES
-- ---- US (USD) -------------------------------------------------------------
  ('therapist','us','individual-session','Individual therapy session', 100, 250, 'per session',
   '{"Virtual": 0.9, "In-person": 1.0, "PhD / specialist": 1.4}'::jsonb,
   10, 'Standard 50-minute session; specialist/PhD clinicians cost more. USD.'),
  ('therapist','us','couples-session','Couples therapy session', 120, 300, 'per session',
   '{"Virtual": 0.9, "In-person": 1.0}'::jsonb,
   20, 'Couples/marriage session, typically 50-80 minutes. USD.'),
  ('therapist','us','family-session','Family therapy session', 120, 300, 'per session',
   '{"Virtual": 0.9, "In-person": 1.0}'::jsonb,
   30, 'Family session, typically 50-80 minutes. USD.'),
  ('therapist','us','group-session','Group therapy session', 40, 100, 'per session',
   '{"Standard": 1.0}'::jsonb,
   40, 'Per-person group session rate. USD.'),
  ('therapist','us','intake-assessment','Therapy intake assessment', 150, 400, 'flat',
   '{"Standard": 1.0, "Comprehensive": 1.8}'::jsonb,
   50, 'First/intake appointment; comprehensive assessments run longer. USD.'),
-- ---- CA (CAD) -------------------------------------------------------------
  ('therapist','ca','individual-session','Individual therapy session', 100, 220, 'per session',
   '{"Virtual": 0.9, "In-person": 1.0, "PhD / specialist": 1.4}'::jsonb,
   10, 'Standard 50-minute session; specialist/PhD clinicians cost more. CAD.'),
  ('therapist','ca','couples-session','Couples therapy session', 120, 260, 'per session',
   '{"Virtual": 0.9, "In-person": 1.0}'::jsonb,
   20, 'Couples/marriage session, typically 50-80 minutes. CAD.'),
  ('therapist','ca','family-session','Family therapy session', 120, 260, 'per session',
   '{"Virtual": 0.9, "In-person": 1.0}'::jsonb,
   30, 'Family session, typically 50-80 minutes. CAD.'),
  ('therapist','ca','group-session','Group therapy session', 40, 90, 'per session',
   '{"Standard": 1.0}'::jsonb,
   40, 'Per-person group session rate. CAD.'),
  ('therapist','ca','intake-assessment','Therapy intake assessment', 150, 350, 'flat',
   '{"Standard": 1.0, "Comprehensive": 1.8}'::jsonb,
   50, 'First/intake appointment; comprehensive assessments run longer. CAD.')
ON CONFLICT (vertical, market, service) DO UPDATE SET
  service_label      = EXCLUDED.service_label,
  base_low           = EXCLUDED.base_low,
  base_high          = EXCLUDED.base_high,
  unit               = EXCLUDED.unit,
  complexity_options = EXCLUDED.complexity_options,
  sort_order         = EXCLUDED.sort_order,
  notes              = EXCLUDED.notes,
  updated_at         = now();
