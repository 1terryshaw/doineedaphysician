import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { generateToken } from "@/lib/auth";
import { sendClaimEmail, sendAddBusinessEmail } from "@/lib/email";
import { normalizeGbpUrl } from "@/lib/gbp-url";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 3; // max self-serve submissions per IP / 24h
const VALID_COUNTRIES = new Set(["US", "CA"]);

// Single-trade vertical: the trade is fixed, not chosen on the form.
const TRADE_CATEGORY = "therapist";

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || null;
  return req.headers.get("x-real-ip") || null;
}

function slugify(s: string): string {
  return (
    (s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "business"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${generateToken().slice(0, 4)}`;
    const { data } = await supabaseAdmin.from(LISTINGS_TABLE).select("id").eq("slug", candidate).limit(1);
    if (!data || data.length === 0) return candidate;
  }
  return `${base}-${generateToken().slice(0, 8)}`;
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const business_name = (body.business_name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim();
  const city = (body.city || "").trim();
  const province = (body.province || "").trim().toUpperCase();
  const country = (body.country || "").trim().toUpperCase();
  const website = (body.website || "").trim();
  const gbp_raw = (body.gbp_url || "").trim();

  if (!business_name || !email || !phone || !city || !province || !country || !gbp_raw) return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  if (!VALID_COUNTRIES.has(country)) return NextResponse.json({ error: "Please choose a valid country." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

  const ip = clientIp(req);

  // rate-limit (per IP / 24h)
  if (ip) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin.from(LISTINGS_TABLE).select("id", { count: "exact", head: true }).eq("submitted_ip", ip).gt("submitted_at", since);
    if ((count ?? 0) >= RATE_LIMIT) return NextResponse.json({ error: "You've submitted a few businesses recently — give it 24 hours." }, { status: 429 });
  }

  // disposable email block
  const domain = email.split("@")[1] || "";
  try {
    const disposable = (await import("disposable-email-domains")).default as string[];
    if (domain && disposable.includes(domain)) return NextResponse.json({ error: "Please use a business email address." }, { status: 400 });
  } catch { /* fail-open */ }

  const gbp = await normalizeGbpUrl(gbp_raw);
  if (!gbp.ok) return NextResponse.json({ error: gbp.error }, { status: 400 });

  // dedup — anti-hijack guard keys on the operative claim flag (`claimed`)
  type MatchedListing = { id: number; business_name: string | null; slug: string; claimed: boolean };
  let matched: MatchedListing | null = null;
  if (gbp.gbp_place_id || gbp.gbp_cid) {
    const ors: string[] = [];
    if (gbp.gbp_place_id) ors.push(`google_place_id.eq.${gbp.gbp_place_id}`, `gbp_place_id.eq.${gbp.gbp_place_id}`);
    if (gbp.gbp_cid) ors.push(`gbp_cid.eq.${gbp.gbp_cid}`);
    const { data } = await supabaseAdmin.from(LISTINGS_TABLE).select("id, business_name, slug, claimed").or(ors.join(",")).limit(1);
    if (data && data.length) matched = data[0] as unknown as MatchedListing;
  }
  if (!matched) {
    const { data } = await supabaseAdmin.from(LISTINGS_TABLE).select("id, business_name, slug, claimed").ilike("business_name", business_name).ilike("city", city).limit(1);
    if (data && data.length) matched = data[0] as unknown as MatchedListing;
  }

  const token = generateToken();
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (matched) {
    if (!matched.claimed) {
      await supabaseAdmin.from(LISTINGS_TABLE).update({ owner_auth_token: token, owner_auth_token_expires_at: expiresAt, owner_email: email, submitted_by_email: email }).eq("id", matched.id);
      const sent = await sendClaimEmail(email, matched.slug, token);
      if (!sent.ok) return NextResponse.json({ error: "Could not send the verification email. Please try again." }, { status: 502 });
    } else { console.log("[list-your-business] dedup hit on already-claimed listing", matched.slug, "— no re-bind"); }
    return NextResponse.json({ status: "matched_existing", business_name: matched.business_name || business_name });
  }

  const city_slug = slugify(city);
  const slug = await uniqueSlug(`${slugify(business_name)}-${city_slug}`);

  const insertRow = {
    name: business_name,
    slug,
    trade_category: TRADE_CATEGORY,
    listing_type: TRADE_CATEGORY,
    city,
    city_slug,
    region_slug: city_slug,
    province_state: province,
    country,
    email,
    phone,
    website: website || null,
    is_published: false,
    is_claimed: false,
    claimed: false,
    source: "self_serve",
    owner_email: email,
    owner_auth_token: token,
    owner_auth_token_expires_at: expiresAt,
    submitted_via: "self_serve",
    submission_status: "pending_verification",
    submitted_by_email: email,
    submitted_at: nowIso,
    submitted_ip: ip,
    gbp_url: gbp.gbp_url,
    gbp_place_id: gbp.gbp_place_id,
    gbp_cid: gbp.gbp_cid,
  };

  const { error: insertError } = await supabaseAdmin.from(LISTINGS_TABLE).insert(insertRow);
  if (insertError) { console.error("[list-your-business] insert failed:", insertError.message); return NextResponse.json({ error: "Could not create your listing. Please try again." }, { status: 500 }); }

  const sent = await sendAddBusinessEmail(email, slug, token, business_name);
  if (!sent.ok) return NextResponse.json({ error: "Listing saved but the email failed to send. Please try the resend link or contact support." }, { status: 502 });

  return NextResponse.json({ status: "created", listing_slug: slug });
}
