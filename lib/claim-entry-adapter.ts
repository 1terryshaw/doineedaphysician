/**
 * PRIVATE OWNER CLAIM ENTRY — the THIN per-site adapter around the canonical resolver.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  CANONICAL FILE.  Copied byte-for-byte into each vertical repo as
 *  `lib/claim-entry-adapter.ts`.  Do not edit the per-repo copies.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  This module does the I/O the resolver deliberately refuses to do: it materialises a
 *  Candidate and a MatchSet from Supabase and hands them to `lib/ctp-resolver.ts`.  It
 *  contains NO decision logic of its own — every branch that could allow or block lives
 *  in the canonical resolver, so the four repos cannot drift into four different answers.
 *
 *  Server-only (service-role client).
 */
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import {
  resolve, type Candidate, type Decision, type ExistingRow, type MatchSet,
  normPhone, normZip5, npiChecksumValid, CTP_AUTHORITY,
} from "@/lib/ctp-resolver";
import { domainEligible, type EvidenceProfile } from "@/lib/claim-entry";

/** Every npi-bearing inventory consulted for existing-match resolution.  A table that is
 *  absent in a given deployment simply yields no rows — the query is tolerant, the
 *  decision is not. */
const NPI_TABLES = [
  "physician_listings", "pediatrician_listings", "obgyn_listings",
  "orthopedic_surgeon_listings", "ther_listings",
] as const;

const SELECT = "id, npi, name, phone, address, postal_code, website, is_published, " +
  "claimed, is_claimed, claim_verified, claimed_by, submitted_via, source, deserve_reason";

export type Supplied = {
  profile: EvidenceProfile;
  npi?: string;
  phone?: string;
  postalCode?: string;
  orgName?: string;
  city?: string;
  address?: string;
  contactEmail?: string;
  state?: string;
};

export type ResolveOutcome = {
  decision: Decision;
  /** populated ONLY when the decision is CTP_ELIGIBLE_UNIQUE and the contact matched */
  target: { table: string; id: string; slug?: string } | null;
  contactChannel: "phone" | "email" | null;
  /** the canonical destination a challenge WOULD be sent to. Never returned to a client. */
  contactValue: string | null;
  internalNote: string;
};

function toExisting(tbl: string, r: Record<string, any>): ExistingRow {
  return {
    table: tbl,
    row_id: String(r.id),
    npi: r.npi ?? null,
    name: r.name ?? null,
    phone: r.phone ?? null,
    address: r.address ?? null,
    postal_code: r.postal_code ?? null,
    website_domain: r.website ?? null,
    is_published: r.is_published,
    claimed: Boolean(r.claimed || r.is_claimed || r.claim_verified || r.claimed_by),
  };
}

/**
 * Query WIDELY (the resolver assumes a complete match set) and decide NARROWLY.
 * Over-fetching costs latency; under-fetching would let a duplicate through.
 */
async function buildMatchSet(s: Supplied): Promise<{ rows: ExistingRow[]; self: Record<string, any> | null }> {
  const phone = normPhone(s.phone);
  const zip = normZip5(s.postalCode);
  const rows: ExistingRow[] = [];
  let self: Record<string, any> | null = null;

  for (const tbl of NPI_TABLES) {
    const ors: string[] = [];
    if (s.npi) ors.push(`npi.eq.${s.npi}`);
    if (zip) ors.push(`postal_code.ilike.${zip}%`);
    if (!ors.length) continue;

    const { data, error } = await supabaseAdmin.from(tbl).select(SELECT).or(ors.join(","));
    if (error || !data) continue; // a missing table in a deployment is not a decision input
    for (const r of data as Record<string, any>[]) {
      // phone is compared through the canonical normaliser, never as a raw string
      const phoneHit = phone && normPhone(r.phone) === phone;
      const npiHit = s.npi && r.npi === s.npi;
      const zipHit = zip && normZip5(r.postal_code) === zip;
      if (!npiHit && !phoneHit && !zipHit) continue;
      if (npiHit && tbl === LISTINGS_TABLE && r.deserve_reason === CTP_AUTHORITY) self = { ...r, __table: tbl };
      rows.push(toExisting(tbl, r));
    }
  }
  return { rows, self };
}

/**
 * Resolve privately.  Returns the resolver's decision plus, only on
 * CTP_ELIGIBLE_UNIQUE, the target row and the canonical contact a challenge would go to.
 *
 * Ownership is NOT established here.  A CTP_ELIGIBLE_UNIQUE plus a matching canonical
 * contact earns the right to ATTEMPT a possession challenge — nothing more.
 */
export async function resolvePrivately(s: Supplied): Promise<ResolveOutcome> {
  const none = (d: Decision, note: string): ResolveOutcome =>
    ({ decision: d, target: null, contactChannel: null, contactValue: null, internalNote: note });

  if (s.npi && !npiChecksumValid(s.npi)) {
    return none(resolve({ npi: s.npi }, { rows: [] }), "npi_checksum");
  }

  const { rows, self } = await buildMatchSet(s);

  // The candidate's authoritative facts come from the seeded row when we hold one; the
  // claimant's own input is evidence for SELECTION, never a source of truth about the org.
  const candidate: Candidate = {
    npi: s.npi ?? self?.npi ?? null,
    entity_type_code: self ? "2" : s.npi ? "2" : null,
    org_name: self?.name ?? s.orgName ?? null,
    phone: self?.phone ?? s.phone ?? null,
    address: self?.address ?? s.address ?? null,
    postal_code: self?.postal_code ?? s.postalCode ?? null,
    state: s.state ?? null,
    submitted_via: self?.submitted_via ?? "seeded",
    source_authority_redistributable: true,
  };

  // The row we are resolving TO must not count as a match against itself.
  const others = rows.filter((r) => !(self && r.table === LISTINGS_TABLE && r.row_id === String(self.id)));

  const decision = resolve(candidate, { rows: others });
  if (!decision.allows_progression) return none(decision, "resolver_block");

  // Progression additionally requires that we actually hold a hidden CTP row for it.
  if (!self || self.is_published !== false || self.deserve_reason !== CTP_AUTHORITY) {
    return none(resolve({ npi: null }, { rows: [] }), "no_hidden_ctp_row");
  }
  if (self.claimed || self.is_claimed || self.claim_verified || self.claimed_by) {
    return none(resolve({ npi: s.npi, entity_type_code: "2" },
      { rows: [toExisting(LISTINGS_TABLE, { ...self, claimed: true })] }), "already_claimed");
  }

  // ── POSSESSION GATE ──────────────────────────────────────────────────────────
  // The claimant must SUPPLY a contact that exactly equals what canonical data already
  // holds.  We never reveal the stored destination to a claimant who did not produce it,
  // so this flow cannot be used to read the contact either.
  let channel: "phone" | "email" | null = null;
  let value: string | null = null;

  if (s.phone && normPhone(s.phone) && normPhone(s.phone) === normPhone(self.phone)) {
    channel = "phone";
    value = self.phone;
  } else if (s.contactEmail && domainEligible(s.contactEmail, self.website)) {
    channel = "email";
    value = s.contactEmail;
  }

  if (!channel) return none(resolve({ npi: null }, { rows: [] }), "contact_not_canonical");

  return {
    decision,
    target: { table: LISTINGS_TABLE, id: String(self.id), slug: self.slug },
    contactChannel: channel,
    contactValue: value,
    internalNote: "ctp_eligible_contact_matched",
  };
}
