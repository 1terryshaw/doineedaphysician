-- ─────────────────────────────────────────────────────────────────────────────
-- PRIVATE OWNER CLAIM ENTRY — additive private intent store.
-- Mission: medical-type2-private-owner-claim-entry-and-ctp-activation-v1-2026-07-24
--
-- ADDITIVE ONLY.  Creates one new table and nothing else.  It does not alter, drop or
-- reference any listings table, any claim table, or any existing policy, so it is
-- reversible by a single DROP (see 10-ROLLBACK-DESIGN.md).
--
-- NOTHING here stores a raw challenge code, a raw phone, a raw email, or a form payload.
-- Every identity value is a keyed hash produced server-side with CLAIM_ENTRY_HASH_KEY.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.medical_claim_intents (
  id                uuid primary key default gen_random_uuid(),

  vertical          text        not null,
  state             text,
  evidence_profile  text        not null
    check (evidence_profile in ('A_NPI_PHONE','B_PHONE_ZIP','C_NAME_LOC_CONTACT')),

  -- the resolver's INTERNAL outcome. Never returned to a client; diagnostics only.
  resolution_code   text        not null,

  -- populated ONLY on CTP_ELIGIBLE_UNIQUE with a matched canonical contact; NULL otherwise
  listing_table     text,
  listing_id        uuid,

  -- SHA-256(code || salt). The code itself never touches the database.
  token_hash        text,
  token_salt        text,

  contact_channel   text        check (contact_channel in ('phone','email')),
  contact_hash      text,                       -- HMAC(contact, CLAIM_ENTRY_HASH_KEY)

  status            text        not null default 'pending'
    check (status in ('pending','dispatch_suppressed','dispatched','verified',
                      'finalized','expired','failed','locked')),

  attempts          integer     not null default 0,
  dispatches        integer     not null default 0,

  -- keyed hashes for abuse correlation only — never reversible to an IP or a device
  ip_hash           text,
  session_hash      text,
  ua_hash           text,
  identifier_hash   text,                       -- HMAC of the submitted NPI, for the per-identifier cap

  guard_decision    boolean,
  guard_reason_code text,

  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  dispatched_at     timestamptz,
  verified_at       timestamptz,
  finalized_at      timestamptz,

  -- a resolved intent must carry BOTH sides of the FK or NEITHER
  constraint claim_intent_target_pair
    check ((listing_table is null) = (listing_id is null))
);

create index if not exists medical_claim_intents_ip_created
  on public.medical_claim_intents (ip_hash, created_at desc);
create index if not exists medical_claim_intents_identifier_created
  on public.medical_claim_intents (identifier_hash, created_at desc);
create index if not exists medical_claim_intents_session_created
  on public.medical_claim_intents (session_hash, created_at desc);
create index if not exists medical_claim_intents_contact_created
  on public.medical_claim_intents (contact_hash, created_at desc);
create index if not exists medical_claim_intents_status_expires
  on public.medical_claim_intents (status, expires_at);

-- ── access ───────────────────────────────────────────────────────────────────
-- Service role only.  RLS is ON with NO permissive policy, so anon/authenticated get
-- nothing even if a grant is later added by accident.  The table is never read from a
-- browser; every access is server-side through the service-role client.
alter table public.medical_claim_intents enable row level security;
revoke all on public.medical_claim_intents from anon, authenticated;

comment on table public.medical_claim_intents is
  'Private claim-entry intents for non-public NPPES Type 2 organisation rows. '
  'Service-role only; RLS on with no policy. Stores keyed hashes only — never a raw '
  'challenge code, phone, email or form payload. 30-day retention (002_claim_intent_retention.sql).';
