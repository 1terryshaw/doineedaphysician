"use client";

// health-leads-plus-conditional-rollout-v1 (TDL #1391) — the ONLY contact form on a health listing, rendered only for a
// Leads Plus listing that passes lib/health-leads-plus.ts leadFormOn(). Fields are fixed by CEO/COO boundary 6:
// name, contact (email / phone), preferred contact time, and — only where the rule allows — a short message under a
// "do not include medical or health details" notice. No symptom / condition / insurance / medication / DOB fields, no uploads.
// Nothing typed here is sent to analytics; the message is e-mailed to the practice and never stored.
import { useRef, useState } from "react";
import verticalConfig from "@/lib/vertical.config";
import { PREFERRED_TIMES, MESSAGE_MAX } from "@/lib/health-leads-plus-shared";

const primary = (verticalConfig as { primaryColor: string }).primaryColor;

export default function HealthLeadForm({
  listingSlug, businessName, freeText, crisisLine,
}: {
  listingSlug: string;
  businessName: string;
  freeText: boolean;
  crisisLine: string | null;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", preferredTime: "any", message: "" });
  const [honeypot, setHoneypot] = useState("");
  const renderedAt = useRef(Date.now());
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("Could not send. Please try again or call the practice.");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() && !form.phone.trim()) {
      setStatus("error"); setErrorMsg("Please give an email address or a phone number."); return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/leads-plus/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingSlug, name: form.name, email: form.email, phone: form.phone, preferredTime: form.preferredTime,
          ...(freeText ? { message: form.message } : {}),
          honeypot, renderedAt: renderedAt.current,
        }),
      });
      if (res.ok) { setStatus("sent"); setForm({ name: "", email: "", phone: "", preferredTime: "any", message: "" }); return; }
      const j = await res.json().catch(() => null);
      setErrorMsg((j && typeof j.error === "string" && j.error) || "Could not send. Please try again or call the practice.");
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  const input = "w-full border rounded-lg px-3 py-2 text-sm";
  return (
    <div id="contact-request" data-testid="health-lead-form">
      <h3 className="font-semibold text-gray-900 mb-1">Request a call back</h3>
      <p className="text-xs text-gray-500 mb-3">Sends your contact details to {businessName}. The practice will contact you.</p>
      {crisisLine && (
        <p role="note" data-testid="crisis-line" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">{crisisLine}</p>
      )}
      {status === "sent" ? (
        <p role="status" className="rounded-lg bg-green-50 border border-green-200 px-3 py-3 text-sm text-green-900">Thanks — your request was sent to the practice.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <label htmlFor="hl-name" className="block text-sm font-medium text-gray-700">Your name</label>
            <input id="hl-name" name="name" required maxLength={80} autoComplete="name" className={input}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="hl-email" className="block text-sm font-medium text-gray-700">Email</label>
            <input id="hl-email" name="email" type="email" maxLength={120} autoComplete="email" className={input}
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="hl-phone" className="block text-sm font-medium text-gray-700">Phone</label>
            <input id="hl-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className={input}
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label htmlFor="hl-time" className="block text-sm font-medium text-gray-700">Best time to contact you</label>
            <select id="hl-time" name="preferredTime" className={input}
              value={form.preferredTime} onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}>
              {PREFERRED_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {freeText && (
            <div>
              <label htmlFor="hl-message" className="block text-sm font-medium text-gray-700">Short note (optional)</label>
              <p id="hl-message-notice" data-testid="no-health-details-notice" className="text-xs font-medium text-amber-800 mb-1">
                Do not include medical or health details. Share only what the practice needs to contact you.
              </p>
              <textarea id="hl-message" name="message" rows={3} maxLength={MESSAGE_MAX} aria-describedby="hl-message-notice" className={input}
                value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>
          )}
          {/* Honeypot: hidden from people, filled by bots. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
            <label htmlFor="hl-company-url">Company URL</label>
            <input id="hl-company-url" name="company_url" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </div>
          {status === "error" && <p role="alert" className="text-sm text-red-700">{errorMsg}</p>}
          <button type="submit" disabled={status === "sending"} className="w-full py-2.5 rounded-lg font-semibold text-white disabled:opacity-60" style={{ backgroundColor: primary }}>
            {status === "sending" ? "Sending…" : "Send request"}
          </button>
          <p className="text-[11px] text-gray-400">Your details go only to this practice. We do not store your note.</p>
        </form>
      )}
    </div>
  );
}
