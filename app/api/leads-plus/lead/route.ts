// health-leads-plus-conditional-rollout-v1 (TDL #1391) — the health Leads Plus contact request.
//
// Gate (server-side, every request): the listing's leads_plus_enabled + claimed + deliverable owner e-mail + the rules-table
// eligibility (public.health_lp_listing_eligible — claim, source rights, jurisdiction, held states). Anything else → 403.
// Fields are a closed set (CEO/COO boundary 6): an unknown key, or a message where the rule has no free text, → 400.
// Storage: public.health_lp_leads keeps name / contact / preferred time / delivery status only. The optional note is e-mailed to
// the practice and NEVER stored. Nothing from the body is logged — error logs carry codes only.
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";
import { isValidEmail } from "@/lib/inquiry-guard";
import {
  healthLpRule, leadFormOn, isTestContext, REGISTRY_SLUG, TEST_INBOX, PREFERRED_TIMES, MESSAGE_MAX, LEADS_PER_LISTING_PER_DAY,
} from "@/lib/health-leads-plus";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_KEYS = new Set(["listingSlug", "name", "email", "phone", "preferredTime", "message", "honeypot", "renderedAt"]);
const TIMES = new Set<string>(PREFERRED_TIMES.map((t) => t.value));
const NOTIFY_FROM = "notifications@doineedanetwork.com";
const MIN_FILL_MS = 2500;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const j = await request.json();
    if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("shape");
    body = j as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (Object.keys(body).some((k) => !ALLOWED_KEYS.has(k))) {
    return NextResponse.json({ error: "Unexpected field." }, { status: 400 });
  }

  const slug = str(body.listingSlug);
  const name = str(body.name).slice(0, 80);
  const email = str(body.email).toLowerCase();
  const phoneRaw = str(body.phone);
  const preferredTime = str(body.preferredTime) || "any";
  const message = str(body.message);
  if (!slug) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // Bot traps: silent success, nothing stored or sent.
  const renderedAt = Number(body.renderedAt);
  if (str(body.honeypot) || !Number.isFinite(renderedAt) || Date.now() - renderedAt < MIN_FILL_MS) {
    return NextResponse.json({ ok: true });
  }

  if (!name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (email && !isValidEmail(email)) return NextResponse.json({ error: "Please check your email address." }, { status: 400 });
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  if (phoneRaw && (phoneDigits.length < 7 || phoneDigits.length > 15)) return NextResponse.json({ error: "Please check your phone number." }, { status: 400 });
  if (!email && !phoneRaw) return NextResponse.json({ error: "Please give an email address or a phone number." }, { status: 400 });
  if (!TIMES.has(preferredTime)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (message.length > MESSAGE_MAX) return NextResponse.json({ error: `Please keep your note under ${MESSAGE_MAX} characters.` }, { status: 400 });

  const { data: listing, error: lerr } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("slug, name, owner_email, claimed, leads_plus_enabled")
    .eq("slug", slug)
    .maybeSingle();
  if (lerr) { console.error("[health-lp-lead] listing read failed", lerr.code); return NextResponse.json({ error: "Please try again." }, { status: 503 }); }
  const rule = await healthLpRule(slug);
  if (!listing || !leadFormOn(listing, rule)) {
    return NextResponse.json({ error: "This practice is not accepting online requests." }, { status: 403 });
  }
  if (message && !rule.free_text) return NextResponse.json({ error: "Unexpected field." }, { status: 400 });

  const test = isTestContext(slug);
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error: cerr } = await supabaseAdmin
    .from("health_lp_leads").select("id", { count: "exact", head: true })
    .eq("vertical_slug", REGISTRY_SLUG).eq("listing_slug", slug).gte("created_at", since);
  if (cerr) { console.error("[health-lp-lead] volume check failed", cerr.code); return NextResponse.json({ error: "Please try again." }, { status: 503 }); }
  if ((count ?? 0) >= LEADS_PER_LISTING_PER_DAY) {
    return NextResponse.json({ error: "This practice has received many requests today. Please call instead." }, { status: 429 });
  }

  const { data: row, error: ierr } = await supabaseAdmin
    .from("health_lp_leads")
    .insert({ vertical_slug: REGISTRY_SLUG, listing_slug: slug, name, email: email || null, phone: phoneRaw ? phoneRaw.slice(0, 40) : null, preferred_contact_time: preferredTime, is_test: test })
    .select("id").single();
  if (ierr || !row) { console.error("[health-lp-lead] insert failed", ierr?.code); return NextResponse.json({ error: "Please try again." }, { status: 503 }); }

  // Off production every lead e-mail goes to the test inbox, never to a real practice.
  const to = process.env.VERCEL_ENV === "production" ? (listing.owner_email as string) : TEST_INBOX;
  const timeLabel = PREFERRED_TIMES.find((t) => t.value === preferredTime)!.label;
  const subject = `${test ? "[TEST] " : ""}New contact request — ${oneLine(name).slice(0, 40)}`;
  const lines: [string, string][] = [["Name", name], ["Email", email || "—"], ["Phone", phoneRaw || "—"], ["Best time to contact", timeLabel]];
  if (message) lines.push(["Note", message]);
  const html =
    `<p>Someone asked ${esc(String(listing.name))} to contact them through your listing on ${esc(verticalConfig.displayDomain)} (Leads Plus).</p>` +
    `<table cellpadding="4">${lines.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</table>` +
    `<p style="color:#666;font-size:12px">This is a contact request, not a referral. We do not store the note — this e-mail is the only copy. ` +
    `Please reply directly to the person.</p>`;
  const text = `Someone asked ${listing.name} to contact them through ${verticalConfig.displayDomain} (Leads Plus).\n\n` +
    lines.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nThis is a contact request, not a referral. We do not store the note.`;

  let delivered = false;
  let deliveryError: string | null = null;
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `${verticalConfig.name} <${NOTIFY_FROM}>`, to, subject, html, text, ...(email ? { replyTo: email } : {}),
    });
    if (error) deliveryError = `resend:${(error as { name?: string }).name ?? "error"}`; else delivered = true;
  } catch {
    deliveryError = "resend:exception";
  }
  if (deliveryError) console.error("[health-lp-lead] delivery failed", deliveryError);
  await supabaseAdmin.from("health_lp_leads").update({ delivered, delivery_error: deliveryError }).eq("id", row.id);

  if (!delivered) return NextResponse.json({ error: "We could not deliver your request. Please call the practice." }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
