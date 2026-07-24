/**
 * CANONICAL NPPES Type-2 organisation CTP RESOLVER — TypeScript binding.  v1.0.0
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  DO NOT EDIT THE PER-REPO COPIES.  This file is the single source of truth and is
 *  copied byte-for-byte into each vertical repo as `lib/ctp-resolver.ts` by
 *  `empire-policy/sync_ctp_resolver.sh`.  `verify_ctp_resolver_sync.sh` fails closed
 *  on any hash mismatch.  Same discipline as `empire-policy/republish_guard.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  This binding MUST stay behaviour-equivalent to `empire-policy/ctp_resolver.py`.
 *  `empire-policy/ctp_resolver_conformance.py` runs BOTH over the shared fixtures in
 *  `empire-policy/ctp_resolver.fixtures.json` and fails closed on any divergence.
 *
 *  WHY IT EXISTS: the frozen TX/GA/FL resolver evaluated the claim-then-publish
 *  short-circuit AHEAD of its existing-match hold, so an unconfirmable match that was
 *  also eponymous reached a write lane (28 rows).  Here, identity resolution
 *  (steps 3-6) runs to completion for every input before any name-derived property
 *  (step 8) is consulted.  There is no path from a blocked state to CTP.
 *
 *  PURE FUNCTION.  No I/O, no DB, no network, no clock, no randomness.  The caller
 *  materialises the Candidate and the MatchSet; that is what makes the two bindings
 *  comparable and every decision reproducible from a frozen manifest.
 *
 *  IDENTITY IS NOT OWNERSHIP.  A returned CTP_ELIGIBLE_UNIQUE grants nothing except
 *  the right to ATTEMPT a possession challenge against a contact channel already
 *  stored in canonical Empire data.  Publication remains the republish guard's.
 */

export const RESOLVER_VERSION = "1.0.0";

export const CTP_AUTHORITY = "nppes_type2_org_claim_then_publish";

export type DecisionCode =
  | "EXISTING_PUBLIC_EXACT"
  | "EXISTING_NONPUBLIC_EXACT"
  | "EXISTING_CLAIMED"
  | "PROBABLE_EXISTING_BLOCK"
  | "MULTIPLE_MATCH_BLOCK"
  | "TYPE1_EXCLUDE"
  | "INACTIVE_OR_REPLACED_NPI_BLOCK"
  | "DEDICATED_VERTICAL_BLOCK_OR_REDIRECT"
  | "FACILITY_ALLOCATION_BLOCK"
  | "CTP_ELIGIBLE_UNIQUE"
  | "NO_ELIGIBLE_MATCH"
  | "INVALID_OR_INSUFFICIENT_EVIDENCE";

export const DECISIONS: ReadonlySet<string> = new Set<string>([
  "EXISTING_PUBLIC_EXACT", "EXISTING_NONPUBLIC_EXACT", "EXISTING_CLAIMED",
  "PROBABLE_EXISTING_BLOCK", "MULTIPLE_MATCH_BLOCK", "TYPE1_EXCLUDE",
  "INACTIVE_OR_REPLACED_NPI_BLOCK", "DEDICATED_VERTICAL_BLOCK_OR_REDIRECT",
  "FACILITY_ALLOCATION_BLOCK", "CTP_ELIGIBLE_UNIQUE", "NO_ELIGIBLE_MATCH",
  "INVALID_OR_INSUFFICIENT_EVIDENCE",
]);

/** CTP_ELIGIBLE_UNIQUE is the ONLY code that permits progression. */
export const ALLOWS_PROGRESSION: ReadonlySet<string> = new Set<string>(["CTP_ELIGIBLE_UNIQUE"]);

export class UnknownResolverState extends Error {}

// ───────────────────────────────────────────── deterministic normalisers

const LEGAL_SUFFIXES: ReadonlySet<string> = new Set<string>([
  "pa", "pc", "pllc", "llc", "lllp", "llp", "lp", "ltd", "limited", "inc",
  "incorporated", "corp", "corporation", "co", "company", "md", "do", "dba",
  "the", "and", "of", "group", "assoc", "associates", "association",
]);

// ASCII punctuation only.  Deliberately NOT /\p{..}/u: the four consuming repos target
// ES5, where the `u` flag is a compile error, and an ASCII class has the additional
// virtue of PRESERVING non-ASCII letters (accents, CJK) rather than deleting them.
// The Python binding uses the byte-identical class so the two cannot diverge.
const PUNCT = /[!-\/:-@\[-`{-~]/g;

export function normNameTokens(name?: string | null): string[] {
  if (!name) return [];
  let s = name.normalize("NFKC").toLowerCase();
  s = s.split("&").join(" and ");
  // dotted abbreviations collapse rather than fragment: "P.A." -> "pa".
  // The period is DELETED (not spaced) so "St. Mary" still yields two tokens.
  s = s.split(".").join("");
  s = s.replace(PUNCT, " ");
  const toks = s.split(/\s+/).filter((t) => t.length > 0 && !LEGAL_SUFFIXES.has(t));
  return toks.sort();
}

export function namesEquivalent(a?: string | null, b?: string | null): boolean {
  const ta = normNameTokens(a);
  const tb = normNameTokens(b);
  if (ta.length === 0 || ta.length !== tb.length) return false;
  for (let i = 0; i < ta.length; i++) if (ta[i] !== tb[i]) return false;
  return true;
}

export function normPhone(p?: string | null): string | null {
  if (!p) return null;
  let d = p.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? d : null;
}

export function normZip5(z?: string | null): string | null {
  if (!z) return null;
  const d = z.replace(/\D/g, "");
  return d.length >= 5 ? d.slice(0, 5) : null;
}

const ADDR_ABBR: Record<string, string> = {
  street: "st", avenue: "ave", boulevard: "blvd", road: "rd", drive: "dr",
  lane: "ln", court: "ct", place: "pl", suite: "ste", parkway: "pkwy",
  highway: "hwy", north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
  circle: "cir", terrace: "ter", building: "bldg", floor: "fl",
};

export function normAddr(a?: string | null): string | null {
  if (!a) return null;
  let s = a.normalize("NFKC").toLowerCase();
  s = s.replace(PUNCT, " ");
  const toks = s.split(/\s+/).filter((t) => t.length > 0).map((t) => ADDR_ABBR[t] ?? t);
  const out = toks.join(" ");
  return out.length > 0 ? out : null;
}

/** NPI check digit: Luhn over "80840" + first 9 digits (CMS spec). */
export function npiChecksumValid(npi?: string | null): boolean {
  if (!npi || !/^\d{10}$/.test(npi)) return false;
  const body = "80840" + npi.slice(0, 9);
  let total = 0;
  let dbl = true;
  for (let i = body.length - 1; i >= 0; i--) {
    let d = body.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
    dbl = !dbl;
  }
  return (total + (npi.charCodeAt(9) - 48)) % 10 === 0;
}

// ───────────────────────────────────────────── input shapes

export type Candidate = {
  npi?: string | null;
  entity_type_code?: string | null;
  deactivation_date?: string | null;
  reactivation_date?: string | null;
  replacement_npi?: string | null;
  org_name?: string | null;
  phone?: string | null;
  address?: string | null;
  postal_code?: string | null;
  state?: string | null;
  taxonomy?: string | null;
  target_vertical?: string | null;
  source?: string | null;
  submitted_via?: string | null;
  is_facility?: boolean;
  is_chain_parent?: boolean;
  dedicated_vertical?: string | null;
  source_authority_redistributable?: boolean;
  /** step 8 ONLY — can never overturn steps 3-6 */
  eponymous?: boolean | null;
};

export type ExistingRow = {
  table: string;
  row_id?: string | null;
  npi?: string | null;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  postal_code?: string | null;
  website_domain?: string | null;
  is_published?: boolean | null;
  claimed?: boolean;
};

export type MatchSet = {
  rows?: ExistingRow[];
  census_asserted_existing_match?: boolean;
  census_match_confirmed?: boolean;
  crosswalk_row?: ExistingRow | null;
};

export type Decision = {
  code: DecisionCode;
  why: string;
  matched_table?: string | null;
  matched_row_id?: string | null;
  resolver_version: string;
  allows_progression: boolean;
};

function decide(
  code: DecisionCode, why: string,
  table?: string | null, rowId?: string | null,
): Decision {
  return {
    code, why,
    matched_table: table ?? null,
    matched_row_id: rowId ?? null,
    resolver_version: RESOLVER_VERSION,
    allows_progression: ALLOWS_PROGRESSION.has(code),
  };
}

// ───────────────────────────────────────────── the ladder

type Hit = { row: ExistingRow; why: string };

function exactRows(c: Candidate, ms: MatchSet): Hit[] {
  const cp = normPhone(c.phone);
  const cz = normZip5(c.postal_code);
  const ca = normAddr(c.address);
  const out: Hit[] = [];
  for (const r of ms.rows ?? []) {
    if (c.npi && r.npi && c.npi === r.npi) {
      out.push({ row: r, why: "exact_npi" });
      continue;
    }
    const rz = normZip5(r.postal_code);
    if (cp && cz && rz === cz && normPhone(r.phone) === cp && namesEquivalent(c.org_name, r.name)) {
      out.push({ row: r, why: "exact_phone_zip_name" });
      continue;
    }
    if (ca && cz && rz === cz && normAddr(r.address) === ca && namesEquivalent(c.org_name, r.name)) {
      out.push({ row: r, why: "exact_addr_zip_name" });
    }
  }
  if (ms.crosswalk_row) out.push({ row: ms.crosswalk_row, why: "canonical_crosswalk" });
  return out;
}

function probableRows(c: Candidate, ms: MatchSet, exact: Hit[]): Hit[] {
  const taken = new Set(exact.map((h) => h.row));
  const cp = normPhone(c.phone);
  const cz = normZip5(c.postal_code);
  const ca = normAddr(c.address);
  const out: Hit[] = [];
  for (const r of ms.rows ?? []) {
    if (taken.has(r)) continue;
    const rz = normZip5(r.postal_code);
    const hits: string[] = [];
    if (cp && normPhone(r.phone) === cp) hits.push("phone");
    if (ca && normAddr(r.address) === ca) hits.push("address");
    if (cz && rz === cz && namesEquivalent(c.org_name, r.name)) hits.push("zip+name");
    if (namesEquivalent(c.org_name, r.name) && cp && normPhone(r.phone) === cp) hits.push("name+phone");
    if (hits.length > 0) {
      out.push({ row: r, why: Array.from(new Set(hits)).sort().join("+") });
    }
  }
  return out;
}

export function resolve(
  c: Candidate,
  ms: MatchSet,
  opts?: { requestValid?: boolean; requestInvalidReason?: string },
): Decision {
  const requestValid = opts?.requestValid !== false;

  // 1 — request validity & abuse
  if (!requestValid) {
    return decide("INVALID_OR_INSUFFICIENT_EVIDENCE",
      `request rejected: ${opts?.requestInvalidReason || "invalid"}`);
  }

  // 2 — NPI format + NPPES identity
  if (c.npi !== undefined && c.npi !== null) {
    if (!npiChecksumValid(c.npi)) {
      return decide("INVALID_OR_INSUFFICIENT_EVIDENCE", "npi failed format/checksum");
    }
    if (c.entity_type_code !== undefined && c.entity_type_code !== null
        && String(c.entity_type_code) !== "2") {
      return decide("TYPE1_EXCLUDE",
        `entity_type_code=${c.entity_type_code}; not a Type 2 organisation`);
    }
    if (c.replacement_npi) {
      return decide("INACTIVE_OR_REPLACED_NPI_BLOCK",
        `replacement npi present (${c.replacement_npi})`);
    }
    if (c.deactivation_date && !c.reactivation_date) {
      return decide("INACTIVE_OR_REPLACED_NPI_BLOCK",
        `deactivated ${c.deactivation_date}, no reactivation`);
    }
  }

  // 3 — exact existing match (public AND non-public, every inventory)
  const exact = exactRows(c, ms);
  if (exact.length > 0) {
    const claimed = exact.filter((h) => h.row.claimed);
    if (claimed.length > 0) {
      return decide("EXISTING_CLAIMED", `exact match on a CLAIMED row (${claimed[0].why})`,
        claimed[0].row.table, claimed[0].row.row_id);
    }
    const pub = exact.filter((h) => h.row.is_published !== false);
    if (pub.length > 0) {
      return decide("EXISTING_PUBLIC_EXACT", `exact match on a served row (${pub[0].why})`,
        pub[0].row.table, pub[0].row.row_id);
    }
    return decide("EXISTING_NONPUBLIC_EXACT", `exact match on a non-public row (${exact[0].why})`,
      exact[0].row.table, exact[0].row.row_id);
  }

  // 4 — probable / multiple
  const probable = probableRows(c, ms, exact);
  if (probable.length > 1) {
    const tables = Array.from(new Set(probable.map((h) => h.row.table))).sort();
    return decide("MULTIPLE_MATCH_BLOCK",
      `${probable.length} convergent candidates: ${tables.join(",")}`);
  }
  if (probable.length === 1) {
    return decide("PROBABLE_EXISTING_BLOCK",
      `single convergent non-exact match (${probable[0].why})`,
      probable[0].row.table, probable[0].row.row_id);
  }

  // 4b — an unconfirmable census-asserted match is a PROBABLE match, unconditionally.
  //      THIS IS THE REPAIR: the frozen resolver let eponymy bypass exactly this hold.
  if (ms.census_asserted_existing_match && !ms.census_match_confirmed) {
    return decide("PROBABLE_EXISTING_BLOCK",
      "census asserted an existing Empire match that could not be confirmed "
      + "or refuted by exact evidence; held regardless of eponymy");
  }

  // 5 — existing claim/ownership state with no match is vacuous; covered at step 3.

  // 6 — dedicated vertical / facility allocation
  if (c.dedicated_vertical) {
    return decide("DEDICATED_VERTICAL_BLOCK_OR_REDIRECT",
      `taxonomy allocated to ${c.dedicated_vertical}`);
  }
  if (c.is_facility) return decide("FACILITY_ALLOCATION_BLOCK", "facility/institution");
  if (c.is_chain_parent) return decide("FACILITY_ALLOCATION_BLOCK", "chain / multi-location parent");

  // 7 — source eligibility & truthful provenance
  if (c.source_authority_redistributable === false) {
    return decide("INVALID_OR_INSUFFICIENT_EVIDENCE", "source authority not redistributable");
  }
  if (c.submitted_via !== undefined && c.submitted_via !== null && c.submitted_via !== "seeded") {
    return decide("INVALID_OR_INSUFFICIENT_EVIDENCE",
      `untruthful provenance submitted_via='${c.submitted_via}'`);
  }

  // 8 — organisation / eponymy classification.  Informational ONLY at this point:
  //     identity is already fully resolved, so this can no longer overturn 3-6.

  // 9 — CTP lane eligibility
  if (c.npi && String(c.entity_type_code) === "2") {
    return decide("CTP_ELIGIBLE_UNIQUE",
      "active Type 2, unique, no exact/probable/multiple match, correctly allocated");
  }

  // 10 — nothing resolved
  if ((c.npi === undefined || c.npi === null) && (ms.rows ?? []).length === 0) {
    return decide("NO_ELIGIBLE_MATCH", "no candidate resolved from the supplied evidence");
  }

  throw new UnknownResolverState(
    `unhandled resolver state npi=${c.npi} etc=${c.entity_type_code} rows=${(ms.rows ?? []).length}`);
}
