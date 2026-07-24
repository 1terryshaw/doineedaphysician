-- Retention reaper for medical_claim_intents. Idempotent; safe to run repeatedly.
-- Not scheduled by this mission — nothing accumulates while the route is dark.
begin;
  update public.medical_claim_intents
     set status = 'expired'
   where status in ('pending','dispatched','dispatch_suppressed')
     and expires_at < now();

  delete from public.medical_claim_intents
   where created_at < now() - interval '30 days';
commit;
