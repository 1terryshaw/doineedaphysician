import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export const MAX_GBP_URL_LENGTH = 2_048;
export const MAX_REDIRECTS = 3;
export const RESOLVER_TIMEOUT_MS = 6_000;
export const MAX_RESPONSE_BYTES = 32_768;

export type GbpConnectorError =
  | "invalid_url"
  | "unsupported_google_link"
  | "redirect_left_google"
  | "could_not_resolve_link"
  | "could_not_extract_place_id"
  | "resolver_timeout";

export type GbpResolution =
  | { ok: true; placeId: string; normalizedUrl: string; mode: "literal" | "redirect" | "searchtext_namecoords" }
  | { ok: false; code: GbpConnectorError };

type ResolverDependencies = {
  fetch?: typeof fetch;
  lookup?: typeof dnsLookup;
};

const PLACE_ID = /\b(ChIJ[A-Za-z0-9_-]{10,250})\b/;
// Google's own Share → Copy-link (maps.app.goo.gl/…) frequently resolves to a
// /maps/place/…/data=!…!1s0x<hex>:0x<hex>… URL that carries NO ChIJ place id — the
// place is identified by the feature-id / CID-hex pair in the `!1s0x…:0x…` data
// segment (hex2 = CID). Accept it as the identifier when no ChIJ is present, matching
// lib/gbp-url.ts extract(). This is still pure URL parsing — no Places API call.
const FEATURE_ID = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i;
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);

// An explicit Google registry, rather than a suffix match, prevents lookalikes such
// as google.com.attacker.test. Short hosts are the only permitted redirect entrypoints.
const GOOGLE_SUFFIXES = new Set([
  "com", "ca", "co.uk", "com.au", "de", "fr", "it", "es", "nl", "be", "ch", "at", "ie", "pt",
  "se", "no", "dk", "fi", "pl", "cz", "sk", "hu", "ro", "gr", "com.br", "com.mx", "com.ar",
  "co.in", "co.jp", "co.kr", "co.nz", "co.za", "com.tr", "com.sg", "com.hk", "com.tw", "co.th",
  "com.my", "com.ph", "com.vn", "co.id", "ae", "sa", "co.il", "com.ua", "ru", "com.pk", "com.bd",
]);

function isApprovedGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (SHORT_HOSTS.has(host)) return true;
  const match = host.match(/^(?:[a-z0-9-]+\.)*google\.(.+)$/);
  return Boolean(match && GOOGLE_SUFFIXES.has(match[1]));
}

function isUnsafeAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168 || b === 88)) ||
      (a === 198 && (b === 18 || b === 51)) ||
      (a === 203 && b === 0);
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    return lower === "::" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower) || lower.startsWith("ff") || lower.startsWith("2001:db8");
  }
  return true;
}

function parseApprovedUrl(raw: string): { url?: URL; error?: GbpConnectorError } {
  if (!raw || raw.length > MAX_GBP_URL_LENGTH) return { error: "invalid_url" };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "invalid_url" };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return { error: "invalid_url" };
  if (isIP(url.hostname) || !isApprovedGoogleHost(url.hostname)) return { error: "unsupported_google_link" };
  if (url.pathname.startsWith("/search") || (url.pathname === "/" && url.searchParams.has("q"))) {
    return { error: "unsupported_google_link" };
  }
  return { url };
}

function normalizedStoredUrl(url: URL): string {
  // Only persist the canonical Google origin and path. Query/fragment parameters
  // frequently carry tracking and must not become retained owner-submitted metadata.
  return `https://${url.hostname.toLowerCase()}${url.pathname || "/"}`;
}

function literalPlaceId(value: string): string | null {
  // Prefer a ChIJ place id (dedups against the ChIJ-format google_place_id column);
  // otherwise fall back to the feature-id / CID-hex pair carried by maps.app.goo.gl
  // share links, which have no ChIJ.
  return value.match(PLACE_ID)?.[1] || value.match(FEATURE_ID)?.[1] || null;
}

/** ChIJ place id ONLY (no feature-id fallback) — used for the "already a real place id" fast paths. */
function chijPlaceId(value: string): string | null {
  return value.match(PLACE_ID)?.[1] || null;
}

/** Google's canonical business name from a resolved /maps/place/<NAME>/ URL (URL-decoded, +→space). */
function placeNameFromUrl(url: URL): string | null {
  const m = url.pathname.match(/\/maps\/place\/([^/]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " ")).trim() || null;
  } catch {
    return m[1].replace(/\+/g, " ").trim() || null;
  }
}

/** Exact place coords: prefer the marker (!3d<lat>!4d<lng>); fall back to the @lat,lng viewport centre. */
function coordsFromUrl(url: URL): { lat: number; lng: number } | null {
  const marker = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (marker) return { lat: parseFloat(marker[1]), lng: parseFloat(marker[2]) };
  const centre = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (centre) return { lat: parseFloat(centre[1]), lng: parseFloat(centre[2]) };
  return null;
}

function normLower(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Confidence guard: at least half of the URL name's distinctive (>=4-char) tokens appear in the candidate. */
function nameOverlaps(urlName: string, candidateName: string): boolean {
  const cand = normLower(candidateName);
  if (!cand) return false;
  const toks = normLower(urlName).split(" ").filter((t) => t.length >= 4);
  if (!toks.length) return false;
  const hits = toks.filter((t) => cand.includes(t)).length;
  return hits / toks.length >= 0.5;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Recovery step: a Google Copy/Share link carries only a feature-id (no ChIJ). The resolved URL,
 * however, contains Google's canonical business name (/maps/place/<NAME>/) and exact coords
 * (!3d/!4d). Search Places with THAT name, location-biased on those coords, and accept the top
 * result's ChIJ id only if it is name-confident AND within ~150 m. Returns null (no throw) when the
 * key env is empty, the URL lacks name/coords, or nothing clears the confidence bar. This is a
 * per-listing REFRESH resolution of an already-seeded, claimed row (permitted).
 */
async function searchTextResolve(
  url: URL,
  deps: Required<ResolverDependencies>,
  deadline: number,
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null; // no key (local/no-key env) — skip, never throw
  const name = placeNameFromUrl(url);
  const coords = coordsFromUrl(url);
  if (!name || !coords) return null;
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;
  try {
    const res = await deps.fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: name,
        locationBias: { circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: 100.0 } },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(remaining),
    });
    if (!res.ok) return null;
    const data: {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        location?: { latitude?: number; longitude?: number };
      }>;
    } = await res.json();
    const c = (data.places || [])[0];
    if (!c?.id || !/^ChIJ/i.test(c.id)) return null;
    if (!nameOverlaps(name, c.displayName?.text ?? "")) return null;
    const within =
      c.location != null &&
      distanceMeters(coords.lat, coords.lng, c.location.latitude ?? NaN, c.location.longitude ?? NaN) <= 150;
    if (!within) return null;
    return c.id;
  } catch {
    return null;
  }
}

async function assertSafeGoogleAddress(url: URL, lookup: typeof dnsLookup): Promise<GbpConnectorError | null> {
  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isUnsafeAddress(address))) {
      return "could_not_resolve_link";
    }
    return null;
  } catch {
    return "could_not_resolve_link";
  }
}

async function requestRedirect(
  url: URL,
  method: "HEAD" | "GET",
  deps: Required<ResolverDependencies>,
  deadline: number,
): Promise<Response> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new DOMException("Timed out", "TimeoutError");
  const response = await deps.fetch(url, {
    method,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(remaining),
  });
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    void response.body?.cancel();
    throw new Error("response_too_large");
  }
  return response;
}

/** Resolve an owner-pasted Google URL without calling Places or reading a response body. */
export async function resolveGoogleBusinessProfileUrl(
  raw: string,
  dependencies: ResolverDependencies = {},
): Promise<GbpResolution> {
  const parsed = parseApprovedUrl(raw);
  if (!parsed.url) return { ok: false, code: parsed.error! };
  const initial = parsed.url;
  // Fast path: a full Maps URL that already carries a ChIJ place id — no network, no Places call.
  const literalChij = chijPlaceId(initial.href);
  if (literalChij) return { ok: true, placeId: literalChij, normalizedUrl: normalizedStoredUrl(initial), mode: "literal" };

  const deps: Required<ResolverDependencies> = { fetch: dependencies.fetch || fetch, lookup: dependencies.lookup || dnsLookup };
  let current = initial;
  const deadline = Date.now() + RESOLVER_TIMEOUT_MS;

  try {
    // Follow the redirect chain to the terminal Maps URL. A ChIJ at any hop wins immediately.
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const addressError = await assertSafeGoogleAddress(current, deps.lookup);
      if (addressError) return { ok: false, code: addressError };

      let response = await requestRedirect(current, "HEAD", deps, deadline);
      if (response.status === 405 || response.status === 501) {
        response = await requestRedirect(current, "GET", deps, deadline);
      }
      if (!REDIRECT_STATUS.has(response.status)) break; // terminal URL reached — resolve from `current`
      const location = response.headers.get("location");
      if (!location) return { ok: false, code: "could_not_resolve_link" };
      const next = new URL(location, current);
      const nextParsed = parseApprovedUrl(next.href);
      if (!nextParsed.url) {
        return { ok: false, code: nextParsed.error === "unsupported_google_link" ? "redirect_left_google" : "could_not_resolve_link" };
      }
      current = nextParsed.url;
      const hopChij = chijPlaceId(current.href);
      if (hopChij) return { ok: true, placeId: hopChij, normalizedUrl: normalizedStoredUrl(initial), mode: "redirect" };
      if (hop === MAX_REDIRECTS) break; // redirects exhausted — resolve from `current`
    }

    // No literal ChIJ in the URL chain.
    const chijFromCurrent = chijPlaceId(current.href);
    if (chijFromCurrent) return { ok: true, placeId: chijFromCurrent, normalizedUrl: normalizedStoredUrl(initial), mode: "redirect" };

    // Recovery: resolve a real ChIJ from the terminal URL's name + coords (Places searchText).
    const recovered = await searchTextResolve(current, deps, deadline);
    if (recovered) return { ok: true, placeId: recovered, normalizedUrl: normalizedStoredUrl(initial), mode: "searchtext_namecoords" };

    // Fallback: preserve existing behaviour — accept a feature-id / CID pair if present, else fail as before.
    const feature = current.href.match(FEATURE_ID)?.[1] || null;
    if (feature) return { ok: true, placeId: feature, normalizedUrl: normalizedStoredUrl(initial), mode: "redirect" };
    return { ok: false, code: "could_not_extract_place_id" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") return { ok: false, code: "resolver_timeout" };
    return { ok: false, code: "could_not_resolve_link" };
  }
}

export const GBP_OWNER_MESSAGES: Record<GbpConnectorError, string> = {
  invalid_url: "Enter a complete HTTPS Google Business Profile link.",
  unsupported_google_link: "Use a Google Maps or Google Business Profile share link.",
  redirect_left_google: "That link redirected outside Google and was not connected.",
  could_not_resolve_link: "We could not resolve that Google link. Please copy a new share link and try again.",
  could_not_extract_place_id: "We could not find a Google Place ID in that link. Please try a different Google share link.",
  resolver_timeout: "Google took too long to respond. Please try again.",
};

export const __testables__ = { isApprovedGoogleHost, isUnsafeAddress, literalPlaceId, normalizedStoredUrl };
