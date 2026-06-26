"use client";

import { useState, useRef } from "react";
import verticalConfig from "@/lib/vertical.config";

const vc = verticalConfig as unknown as {
  primaryColor: string;
  categories?: { slug: string; label: string }[];
};

export default function InquiryForm({
  listingSlug,
  honest = false,
}: {
  listingSlug: string;
  honest?: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    urgency: "flexible",
    serviceNeeded: "",
  });
  // Honeypot (TDL #455): hidden field bots fill, humans never see. DOM name is
  // "company_url" (disguise); sent in the POST body as `honeypot` (the key the
  // server guard reads). renderedAt lets the server drop sub-2.5s bot submits.
  const [honeypot, setHoneypot] = useState("");
  const renderedAt = useRef(Date.now());
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("Failed to send. Please try again.");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/api/forward-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          listingSlug,
          honeypot,
          renderedAt: renderedAt.current,
        }),
      });
      if (res.ok) {
        setStatus("sent");
        setForm({
          name: "",
          email: "",
          phone: "",
          message: "",
          urgency: "flexible",
          serviceNeeded: "",
        });
      } else {
        // Surface the server's specific message (e.g. the email-format gate)
        // instead of the generic failure copy when one is provided.
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error || "Failed to send. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Failed to send. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-800 font-medium">
          {honest ? "Your request has been received!" : "Your inquiry has been sent!"}
        </p>
        <p className="text-green-600 text-sm mt-1">
          {honest
            ? "We'll pass your request along. If you're the owner, claim this listing to respond directly."
            : "The business will receive your details within seconds."}
        </p>
      </div>
    );
  }

  const categories = vc.categories;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot — off-screen, never seen by humans (TDL #455) */}
      <input
        type="text"
        name="company_url"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hp-field"
      />
      <h3 className="font-semibold text-lg">
        {honest ? "Request a quote" : "Send an Inquiry"}
      </h3>
      {honest && (
        <p className="text-sm text-gray-500 -mt-2">
          We&apos;ll pass your request to this business. Are you the owner?{" "}
          Claim this listing to respond directly.
        </p>
      )}
      <div>
        <input
          type="text"
          placeholder="Your name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <input
          type="email"
          placeholder="Your email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <select
          value={form.urgency}
          onChange={(e) => setForm({ ...form, urgency: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="flexible">Flexible — no rush</option>
          <option value="urgent">Urgent — need help today</option>
          <option value="emergency">Emergency — happening now</option>
        </select>
      </div>
      {categories && categories.length > 0 && (
        <div>
          <select
            value={form.serviceNeeded}
            onChange={(e) =>
              setForm({ ...form, serviceNeeded: e.target.value })
            }
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Service needed (optional)</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.label}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <textarea
          placeholder="Describe what you need help with"
          required
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {status === "error" && (
        <p className="text-red-600 text-sm">{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-2 rounded-lg text-white font-medium disabled:opacity-50"
        style={{ backgroundColor: vc.primaryColor }}
      >
        {status === "sending" ? "Sending..." : "Send Inquiry"}
      </button>
    </form>
  );
}
