"use client";
import { useState } from "react";
import verticalConfig from "@/lib/vertical.config";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/provinces";
type Status = "idle" | "sending" | "created" | "matched" | "error";
export default function AddBusinessForm() {
  const [form, setForm] = useState({ business_name: "", gbp_url: "", email: "", phone: "", city: "", province: "", country: "", website: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [matchedName, setMatchedName] = useState("");
  const regionOptions = form.country === "US" ? US_STATES : form.country === "CA" ? CANADIAN_PROVINCES : [];
  function set<K extends keyof typeof form>(key: K, value: string) { setForm((f) => ({ ...f, [key]: value, ...(key === "country" ? { province: "" } : {}) })); }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setStatus("sending"); setErrorMsg("");
    try {
      const res = await fetch("/api/list-your-business", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "matched_existing") { setMatchedName(data.business_name || form.business_name); setStatus("matched"); }
      else if (res.ok) setStatus("created");
      else { setErrorMsg(data.error || "Something went wrong. Please try again."); setStatus("error"); }
    } catch { setErrorMsg("Network error. Please try again."); setStatus("error"); }
  }
  if (status === "created") return (<div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center"><h3 className="text-xl font-bold" style={{ color: verticalConfig.primaryColor }}>Check your email</h3><p className="text-gray-700 mt-2">We sent you a magic link to verify and finish setting up your listing.</p></div>);
  if (status === "matched") return (<div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center"><h3 className="text-xl font-bold" style={{ color: verticalConfig.primaryColor }}>Good news — you&rsquo;re already listed</h3><p className="text-gray-700 mt-2">We already have a listing for <strong>{matchedName}</strong>. Check your email for a magic link to claim it.</p></div>);
  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400";
  const labelClass = "block text-sm font-medium text-gray-800 mb-1";
  const req = <span style={{ color: verticalConfig.primaryColor }}>*</span>;
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div><label className={labelClass} htmlFor="business_name">Business name {req}</label><input id="business_name" type="text" required value={form.business_name} onChange={(e) => set("business_name", e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass} htmlFor="gbp_url">Google Business Profile URL {req}</label><input id="gbp_url" type="url" required placeholder="https://maps.app.goo.gl/..." value={form.gbp_url} onChange={(e) => set("gbp_url", e.target.value)} className={inputClass} /><p className="text-xs text-gray-500 mt-1">We use this to verify your business and pull your reviews and photos.</p></div>
      <div><label className={labelClass} htmlFor="email">Business email {req}</label><input id="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass} htmlFor="phone">Phone {req}</label><input id="phone" type="tel" required value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className={labelClass} htmlFor="country">Country {req}</label><select id="country" required value={form.country} onChange={(e) => set("country", e.target.value)} className={inputClass}><option value="" disabled>Select…</option><option value="US">United States</option><option value="CA">Canada</option></select></div>
        <div><label className={labelClass} htmlFor="province">State / province {req}</label><select id="province" required value={form.province} disabled={!form.country} onChange={(e) => set("province", e.target.value)} className={inputClass}><option value="" disabled>Select…</option>{regionOptions.map((r) => (<option key={r.code} value={r.code}>{r.name}</option>))}</select></div>
      </div>
      <div><label className={labelClass} htmlFor="city">City {req}</label><input id="city" type="text" required value={form.city} onChange={(e) => set("city", e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass} htmlFor="website">Website URL <span className="text-gray-400">(optional)</span></label><input id="website" type="url" placeholder="https://" value={form.website} onChange={(e) => set("website", e.target.value)} className={inputClass} /></div>
      {status === "error" && <p className="text-red-600 text-sm" role="alert">{errorMsg}</p>}
      <button type="submit" disabled={status === "sending"} style={{ backgroundColor: verticalConfig.primaryColor }} className="w-full px-4 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50">{status === "sending" ? "Submitting…" : "Add my business"}</button>
    </form>
  );
}
