/**
 * PRIVATE OWNER CLAIM ENTRY — shared server-only primitives.  v1.0.0
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  CANONICAL FILE.  Copied byte-for-byte into each vertical repo as
 *  `lib/claim-entry.ts` by `empire-policy/sync_claim_entry.sh`.  Do not edit the
 *  per-repo copies.  `verify_claim_entry_sync.sh` fails closed on drift.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Everything here is FAIL-CLOSED by default: an unset flag disables the feature, an
 *  unset hash key 503s rather than degrading to an unkeyed hash, and every unexpected
 *  state produces the SAME generic response as a successful resolution.
 *
 *  Server-only.  Never import from a client component — it reads secrets.
 */
import crypto from "crypto";

export const CLAIM_ENTRY_VERSION = "1.0.0";

// ───────────────────────────────────────────── feature flags (default OFF)

const on = (v?: string) => v === "1" || v === "true";
const csv = (v?: string) =>
  (v ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

export type Flags = {
  enabled: boolean;
  verticals: string[];
  states: string[];
  profiles: string[];
  dispatchEnabled: boolean;
  finalizeEnabled: boolean;
  guardEnabled: boolean;
  minResponseMs: number;
};

export function flags(): Flags {
  return {
    enabled: on(process.env.CLAIM_ENTRY_ENABLED),
    verticals: csv(process.env.CLAIM_ENTRY_VERTICALS),
    states: csv(process.env.CLAIM_ENTRY_STATES),
    profiles: csv(process.env.CLAIM_ENTRY_PROFILES),
    dispatchEnabled: on(process.env.CLAIM_ENTRY_DISPATCH_ENABLED),
    finalizeEnabled: on(process.env.CLAIM_ENTRY_FINALIZE_ENABLED),
    guardEnabled: on(process.env.CLAIM_ENTRY_GUARD_ENABLED),
    minResponseMs: Number(process.env.CLAIM_ENTRY_MIN_RESPONSE_MS ?? "400"),
  };
}

// ───────────────────────────────────────────── keyed hashing

export class MissingHashKey extends Error {}

function hashKey(): string {
  const k = process.env.CLAIM_ENTRY_HASH_KEY;
  // An UNKEYED hash of a 10-digit NANP phone is brute-forceable in milliseconds, so a
  // fallback would be worse than an outage.  Fail closed.
  if (!k || k.length < 32) throw new MissingHashKey("CLAIM_ENTRY_HASH_KEY unset or too short");
  return k;
}

/** Keyed, non-reversible. Used for every identity value that reaches storage or telemetry. */
export function keyedHash(value: string): string {
  return crypto.createHmac("sha256", hashKey()).update(value.trim().toLowerCase()).digest("hex");
}

/** Per-intent salted digest of the challenge code. The code itself is never stored. */
export function challengeDigest(code: string, salt: string): string {
  return crypto.createHash("sha256").update(`${code}:${salt}`).digest("hex");
}

export function newSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** 6-digit numeric challenge drawn from a CSPRNG, uniformly (no modulo bias). */
export function newChallengeCode(): string {
  let n: number;
  do {
    n = crypto.randomBytes(4).readUInt32BE(0);
  } while (n >= 4_294_000_000); // reject the biased tail
  return String(n % 1_000_000).padStart(6, "0");
}

const HEX = /^[0-9a-f]+$/i;

/**
 * Constant-time compare of two hex digests of equal length.
 *
 * The HEX guard is load-bearing, not decoration: `Buffer.from("zzzz","hex")` silently
 * drops every invalid character and yields an EMPTY buffer, and timingSafeEqual(<empty>,
 * <empty>) is true — so without it, any two equal-length non-hex strings compare EQUAL.
 */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || a.length !== b.length) return false;
  if (a.length % 2 !== 0 || !HEX.test(a) || !HEX.test(b)) return false;
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length === 0 || ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────── uniform response + timing floor

/**
 * THE uniform external response.  Every outcome — hidden hit, no match, Type 1,
 * duplicate, probable match, quarantined, rate-limited, flag-disabled, internal error —
 * returns exactly this body with exactly this status.  It carries no candidate id, no
 * metadata, no count, and no indication of whether a challenge was dispatched.
 */
export const GENERIC_BODY = Object.freeze({
  status: "received",
  message:
    "If the information matches an eligible organization and the supplied contact can be verified, " +
    "you will receive the next verification step.",
});

/**
 * Pad every response to a common floor plus bounded jitter, applied AFTER all work, so a
 * database hit and a database miss are indistinguishable in the timing distribution.
 */
export async function timingFloor(startedAt: number, minMs: number): Promise<void> {
  const jitter = crypto.randomInt(0, 60);
  const wait = minMs + jitter - (Date.now() - startedAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

// ───────────────────────────────────────────── request hardening

export type RequestCheck = { ok: true } | { ok: false; reason: string };

/** Origin + content-type + CSRF double-submit. Enforced in the handler because the
 *  middleware matcher in these repos does not cover /api/*. */
export function checkRequest(req: Request, cookieCsrf: string | undefined): RequestCheck {
  if (req.method !== "POST") return { ok: false, reason: "method" };

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("application/json")) return { ok: false, reason: "content_type" };

  const origin = req.headers.get("origin");
  const expected = process.env.NEXT_PUBLIC_BASE_URL;
  if (!expected) return { ok: false, reason: "base_url_unset" };
  if (!origin || new URL(origin).origin !== new URL(expected).origin) {
    return { ok: false, reason: "origin" };
  }

  const headerCsrf = req.headers.get("x-claim-entry-csrf");
  if (!headerCsrf || !cookieCsrf || headerCsrf.length < 16
      || !safeEqualHex(crypto.createHash("sha256").update(headerCsrf).digest("hex"),
                       crypto.createHash("sha256").update(cookieCsrf).digest("hex"))) {
    return { ok: false, reason: "csrf" };
  }
  return { ok: true };
}

export const MAX_BODY_BYTES = 4096;

/** Strict schema: no unknown keys, every value a bounded string. */
export function parseBody(raw: string, allowed: string[]): Record<string, string> | null {
  if (raw.length > MAX_BODY_BYTES) return null;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof o !== "object" || o === null || Array.isArray(o)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (!allowed.includes(k)) return null;
    if (v === null || v === undefined) continue;
    if (typeof v === "number") { out[k] = String(v); continue; }
    if (typeof v !== "string" || v.length > 512) return null;
    out[k] = v;
  }
  return out;
}

/** Honeypot + minimum dwell, mirroring lib/inquiry-guard.ts which protects the inquiry
 *  form. A trip is a SILENT drop — the caller still returns the generic body. */
export function looksAutomated(body: Record<string, string>): boolean {
  if (body.company_url && body.company_url.trim() !== "") return true;
  const r = Number(body.renderedAt);
  if (Number.isFinite(r) && Date.now() - r < 2500) return true;
  return false;
}

// ───────────────────────────────────────────── rate limits

export const LIMITS = {
  perIpPer15Min: 5,
  perIdentifierPer24h: 3,
  perSessionPer24h: 10,
  dispatchesPerContactPer24h: 3,
  attemptsPerIntent: 5,
  intentTtlMinutes: 15,
  resendCooldownSeconds: 60,
  lockAfterFailuresHours: 24,
} as const;

export type EvidenceProfile = "A_NPI_PHONE" | "B_PHONE_ZIP" | "C_NAME_LOC_CONTACT";

export const PROFILES: EvidenceProfile[] = ["A_NPI_PHONE", "B_PHONE_ZIP", "C_NAME_LOC_CONTACT"];

/** Free-mail domains can never stand as organisation-domain proof, however they appear
 *  in source data. Not exhaustive by design — the real gate is that the domain must
 *  match a canonical organisation website already stored on the row. */
export const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com",
  "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com",
  "proton.me", "gmx.com", "mail.com", "zoho.com", "yandex.com", "comcast.net", "att.net",
  "verizon.net", "sbcglobal.net", "bellsouth.net", "cox.net", "charter.net",
]);

export function emailDomain(email: string): string | null {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(email.trim().toLowerCase());
  return m ? m[1] : null;
}

/** A domain is eligible ONLY when it equals a canonical organisation domain already
 *  present in trusted data. Never inferred, never a free-mail host. */
export function domainEligible(supplied: string, canonicalWebsite: string | null | undefined): boolean {
  const d = emailDomain(supplied);
  if (!d || FREEMAIL.has(d)) return false;
  if (!canonicalWebsite) return false;
  let host: string;
  try {
    host = new URL(canonicalWebsite.includes("://") ? canonicalWebsite : `https://${canonicalWebsite}`)
      .hostname.toLowerCase();
  } catch {
    return false;
  }
  const strip = (h: string) => (h.startsWith("www.") ? h.slice(4) : h);
  return strip(host) === strip(d);
}
