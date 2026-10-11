// TDL #1296 / legacy-inquiry-obs (donor v-obs1): delivery observability for the free forward-lead path.
// Records notified_at / notification_status / provider_message_id / notified_to_kind on the *_inquiries row and
// emails the operator ([INQUIRY-ALERT], no consumer PII in the subject) when a send failed. Never changes WHO receives mail.
import { supabaseAdmin, INQUIRIES_TABLE } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";

const OPERATOR_EMAIL = process.env.INQUIRY_ALERT_TO || "terry@doineedapro.com";
const ALERT_FROM = "Inquiry alerts <notifications@smartwebsitemanagement.ca>";

export type DeliveryStatus = "sent" | "failed" | "bounced" | "needs_bridging";
export type DeliveryKind = "owner" | "scraped" | "none";

export function deliveryKind(forwardTo: string | null | undefined, ownerEmail?: string | null): DeliveryKind {
  if (!forwardTo) return "none";
  const o = (ownerEmail || "").trim().toLowerCase();
  return o && forwardTo.trim().toLowerCase() === o ? "owner" : "scraped";
}

export async function alertOperator(a: { inquiryId: string; slug: string; status: string; kind: string; error?: string | null }): Promise<boolean> {
  const key = process.env.INQUIRY_ALERT_RESEND_KEY || process.env.RESEND_API_KEY;
  if (!key) { console.error("[inquiry-alert] RESEND_API_KEY missing — alert NOT sent", a.inquiryId); return false; }
  const test = a.slug.startsWith("zz-test-") ? "[TEST] " : "";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: OPERATOR_EMAIL,
        subject: `${test}[INQUIRY-ALERT] ${verticalConfig.displayDomain} inquiry ${a.inquiryId.slice(0, 8)} not delivered (${a.status})`,
        text: `Site: ${verticalConfig.displayDomain}\nTable: ${INQUIRIES_TABLE}\nInquiry id: ${a.inquiryId}\nListing slug: ${a.slug}\nStatus: ${a.status}\nDestination kind: ${a.kind}\nProvider error: ${(a.error || "n/a").slice(0, 160)}\n\nThe inquiry is stored. Look it up by id; no consumer PII in this alert. TDL #1296.`,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    if (!res.ok || !data.id) { console.error("[inquiry-alert] alert send failed", res.status, a.inquiryId); return false; }
    return true;
  } catch (e) {
    console.error("[inquiry-alert] alert send threw", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function recordDelivery(a: {
  inquiryId: string | null | undefined;
  slug: string;
  forwardTo: string | null | undefined;
  ownerEmail?: string | null;
  status: DeliveryStatus;
  messageId?: string | null;
  error?: string | null;
  suppressed?: boolean; // smoke-suppressed send: nothing was dispatched, record nothing
}): Promise<void> {
  if (!a.inquiryId || a.suppressed) return;
  let status = a.status;
  let error = a.error ?? null;
  if (status === "sent" && !a.messageId) { status = "failed"; error = error || "provider returned no message id"; }
  const kind = status === "needs_bridging" ? "none" : deliveryKind(a.forwardTo, a.ownerEmail);
  try {
    const { error: updErr } = await supabaseAdmin
      .from(INQUIRIES_TABLE)
      .update({
        notification_status: status,
        notified_to_kind: kind,
        provider_message_id: status === "sent" ? a.messageId ?? null : null,
        notified_at: status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", a.inquiryId);
    if (updErr) console.error(`[inquiry-delivery] status write failed ${a.inquiryId}: ${updErr.message}`);
  } catch (e) {
    console.error("[inquiry-delivery] status write threw", e instanceof Error ? e.message : e);
  }
  if (status === "failed") {
    console.error(`[inquiry-delivery] NOT DELIVERED ${a.inquiryId} (${kind}): ${error}`);
    await alertOperator({ inquiryId: a.inquiryId, slug: a.slug, status, kind, error });
  }
}
