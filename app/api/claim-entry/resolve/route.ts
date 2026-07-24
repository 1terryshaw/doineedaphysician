/**
 * POST /api/claim-entry/resolve — the ONLY private resolution entry point.
 *
 * CANONICAL FILE. Copied byte-for-byte into each vertical repo. Do not edit per-repo copies.
 *
 * EVERY outcome returns the SAME body, the SAME status and the SAME headers, padded to a
 * common timing floor: hidden hit, no match, Type 1, malformed, duplicate, probable
 * match, quarantined, rate-limited, bot-dropped, flag-disabled and internal error are
 * externally indistinguishable.  The only place an outcome is distinguishable is the
 * server-side intent record, which no client can read.
 *
 * This route NEVER writes is_published, any claim column, any tier column, or any
 * listing field at all.  Its only write is an INSERT into medical_claim_intents.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";
import {
  GENERIC_BODY, LIMITS, MissingHashKey, PROFILES, challengeDigest, checkRequest, flags,
  keyedHash, looksAutomated, newChallengeCode, newSalt, parseBody, timingFloor,
  type EvidenceProfile,
} from "@/lib/claim-entry";
import { resolvePrivately } from "@/lib/claim-entry-adapter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_KEYS = [
  "profile", "npi", "phone", "postalCode", "orgName", "city", "address",
  "contactEmail", "state", "company_url", "renderedAt",
];

/** The single external answer. Constructed identically on every path. */
function generic(): NextResponse {
  return NextResponse.json(GENERIC_BODY, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function countSince(col: string, val: string, sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const { count } = await supabaseAdmin
    .from("medical_claim_intents")
    .select("id", { count: "exact", head: true })
    .eq(col, val)
    .gte("created_at", since);
  return count ?? 0;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const f = flags();

  // A disabled route must be indistinguishable from a route that does not exist.
  if (!f.enabled) return new NextResponse(null, { status: 404 });

  try {
    const csrfCookie = request.cookies.get("claim_entry_csrf")?.value;
    const check = checkRequest(request, csrfCookie);
    if (!check.ok) {
      await timingFloor(startedAt, f.minResponseMs);
      return generic();
    }

    const raw = await request.text();
    const body = parseBody(raw, ALLOWED_KEYS);
    if (!body) {
      await timingFloor(startedAt, f.minResponseMs);
      return generic();
    }

    // Silent bot drop — never tip the client that it was detected.
    if (looksAutomated(body)) {
      await timingFloor(startedAt, f.minResponseMs);
      return generic();
    }

    const profile = (body.profile ?? "").toUpperCase() as EvidenceProfile;
    const state = (body.state ?? "").toUpperCase();
    const vertical = verticalConfig.tablePrefix.replace(/_$/, "").toUpperCase();

    const ipHash = keyedHash(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0");
    const uaHash = keyedHash(request.headers.get("user-agent") ?? "");
    const sessionHash = keyedHash(request.cookies.get("claim_entry_sid")?.value ?? `${ipHash}:${uaHash}`);
    const identifierHash = keyedHash(body.npi ?? body.phone ?? body.orgName ?? "unknown");

    // ── rate limits: evaluated for EVERY request, before any inventory is touched ──
    const [byIp, byIdent, bySession] = await Promise.all([
      countSince("ip_hash", ipHash, 15 * 60 * 1000),
      countSince("identifier_hash", identifierHash, 24 * 60 * 60 * 1000),
      countSince("session_hash", sessionHash, 24 * 60 * 60 * 1000),
    ]);
    const limited =
      byIp >= LIMITS.perIpPer15Min ||
      byIdent >= LIMITS.perIdentifierPer24h ||
      bySession >= LIMITS.perSessionPer24h;

    // ── scope gates. A closed gate is recorded internally and answered generically. ──
    const scopeOk =
      PROFILES.includes(profile) &&
      f.profiles.includes(profile) &&
      f.verticals.includes(vertical) &&
      (f.states.length === 0 || f.states.includes(state));

    let resolutionCode = "INVALID_OR_INSUFFICIENT_EVIDENCE";
    let target: { table: string; id: string } | null = null;
    let contactChannel: "phone" | "email" | null = null;
    let contactValue: string | null = null;

    if (!limited && scopeOk) {
      const outcome = await resolvePrivately({
        profile,
        npi: body.npi,
        phone: body.phone,
        postalCode: body.postalCode,
        orgName: body.orgName,
        city: body.city,
        address: body.address,
        contactEmail: body.contactEmail,
        state,
      });
      resolutionCode = outcome.decision.code;
      target = outcome.target;
      contactChannel = outcome.contactChannel;
      contactValue = outcome.contactValue;
    } else if (limited) {
      resolutionCode = "RATE_LIMITED";
    } else {
      resolutionCode = "OUT_OF_SCOPE";
    }

    const progressing = Boolean(target && contactChannel && contactValue);

    // ── intent record ─────────────────────────────────────────────────────────
    // Written for EVERY submission, so the rate limiters see all traffic and so the
    // insert cost does not itself become a timing oracle.
    const salt = newSalt();
    const code = progressing ? newChallengeCode() : null;
    const willDispatch = progressing && f.dispatchEnabled;

    await supabaseAdmin.from("medical_claim_intents").insert({
      vertical: vertical.toLowerCase(),
      state: state || null,
      evidence_profile: PROFILES.includes(profile) ? profile : "A_NPI_PHONE",
      resolution_code: resolutionCode,
      listing_table: progressing ? target!.table : null,
      listing_id: progressing ? target!.id : null,
      token_hash: code ? challengeDigest(code, salt) : null,
      token_salt: code ? salt : null,
      contact_channel: contactChannel,
      contact_hash: contactValue ? keyedHash(contactValue) : null,
      status: progressing ? (willDispatch ? "dispatched" : "dispatch_suppressed") : "failed",
      ip_hash: ipHash,
      session_hash: sessionHash,
      ua_hash: uaHash,
      identifier_hash: identifierHash,
      expires_at: new Date(Date.now() + LIMITS.intentTtlMinutes * 60_000).toISOString(),
      dispatched_at: willDispatch ? new Date().toISOString() : null,
    });

    // ── dispatch ──────────────────────────────────────────────────────────────
    // CLAIM_ENTRY_DISPATCH_ENABLED is OFF in every environment. When a channel that can
    // reach a CANONICAL contact exists, the send goes here — and ONLY to contactValue,
    // which by construction is the value already stored on the row AND the value the
    // claimant independently supplied.
    if (willDispatch) {
      // intentionally unimplemented while no canonical channel exists; see
      // 05-PRIVATE-CLAIM-ENTRY-DESIGN.md §channel. Reaching here with the flag on and no
      // adapter is a no-op, never a fallback to a claimant-chosen destination.
    }

    await timingFloor(startedAt, f.minResponseMs);
    return generic();
  } catch (err) {
    // Even a hash-key outage or an unexpected throw answers generically — an error page
    // would itself be an enumeration signal.
    if (err instanceof MissingHashKey) {
      console.error("claim-entry: CLAIM_ENTRY_HASH_KEY unset — refusing to log weak hashes");
    } else {
      console.error("claim-entry resolve error:", err instanceof Error ? err.message : "unknown");
    }
    await timingFloor(startedAt, f.minResponseMs);
    return generic();
  }
}
