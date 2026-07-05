import { Resend } from "resend";
import verticalConfig from "@/lib/vertical.config";
import { claimCtaHtml, claimCtaText, verticalDomain } from "@/lib/claim-pitch";

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}
const FROM_ADDRESS = "notifications@smartwebsitemanagement.ca";
const CASL_SENDER = "Smart Website Management"; // legal sender behind every empire directory

// Transactional auth sender (owner login + claim verification). Distinct from the
// notifications@ lead/inquiry sender. Migrated off Gmail SMTP — see lib/email.ts.
const AUTH_FROM = "Smart Website Management <auth@smartwebsitemanagement.ca>";

export type AuthSendResult = { ok: true; id: string } | { ok: false; error: string };

interface LeadEmailData {
  businessName: string;
  businessEmail: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  message?: string;
  serviceNeeded?: string;
  urgency?: string;
  sourcePage?: string;
}

export async function sendLeadForwardEmail(
  data: LeadEmailData
): Promise<{ success: boolean; error?: string }> {
  const directoryName = verticalConfig.name;
  const domain = verticalConfig.domain;
  const displayDomain = verticalConfig.displayDomain;

  const urgencyBadge =
    data.urgency === "emergency"
      ? '<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">EMERGENCY</span>'
      : data.urgency === "urgent"
        ? '<span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">URGENT</span>'
        : '<span style="background:#6b7280;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">Flexible</span>';

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:${verticalConfig.primaryColor};padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">New Lead from ${directoryName}</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">${displayDomain}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;font-size:15px;">Hi <strong>${data.businessName}</strong>, you have a new lead!</p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr>
        <td style="padding:8px 0;color:#6b7280;width:120px;vertical-align:top;">Name</td>
        <td style="padding:8px 0;font-weight:600;">${data.visitorName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top;">Email</td>
        <td style="padding:8px 0;"><a href="mailto:${data.visitorEmail}" style="color:${verticalConfig.primaryColor};">${data.visitorEmail}</a></td>
      </tr>
      ${data.visitorPhone ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Phone</td><td style="padding:8px 0;"><a href="tel:${data.visitorPhone}" style="color:${verticalConfig.primaryColor};">${data.visitorPhone}</a></td></tr>` : ""}
      <tr>
        <td style="padding:8px 0;color:#6b7280;vertical-align:top;">Urgency</td>
        <td style="padding:8px 0;">${urgencyBadge}</td>
      </tr>
      ${data.serviceNeeded ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Service</td><td style="padding:8px 0;">${data.serviceNeeded}</td></tr>` : ""}
    </table>

    ${data.message ? `<div style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:3px solid ${verticalConfig.primaryColor};border-radius:4px;font-size:14px;line-height:1.5;">${data.message}</div>` : ""}

    <div style="margin-top:20px;">
      <a href="mailto:${data.visitorEmail}?subject=Re: Your inquiry on ${directoryName}" style="display:inline-block;padding:12px 24px;background:${verticalConfig.primaryColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Reply to ${data.visitorName} →</a>
    </div>

    ${data.visitorPhone ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;">Or call directly: <a href="tel:${data.visitorPhone}" style="color:${verticalConfig.primaryColor};font-weight:600;">${data.visitorPhone}</a></p>` : ""}

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
    <p style="font-size:11px;color:#9ca3af;margin:0;">This lead was sent through ${directoryName} (${displayDomain}). Manage your listing at https://${domain}/owner/login</p>
  </div>
</div>`;

  try {
    const { error } = await getResend().emails.send({
      from: `${directoryName} <${FROM_ADDRESS}>`,
      to: data.businessEmail,
      replyTo: data.visitorEmail,
      subject: `🔔 New lead from ${directoryName} — ${data.visitorName}`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("Resend exception:", err);
    return { success: false, error: err.message };
  }
}


/**
 * Branded confirmation email sent to the prospect (visitor) after they submit
 * an inquiry on a Reviews Plus listing. Reassures them the inquiry reached the
 * business and carries the directory's name + styling.
 */
export async function sendInquiryConfirmation(
  data: LeadEmailData
): Promise<{ success: boolean; error?: string }> {
  const directoryName = verticalConfig.name;
  const displayDomain = verticalConfig.displayDomain;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:${verticalConfig.primaryColor};padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">${directoryName}</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">${displayDomain}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;font-size:15px;">Hi <strong>${data.visitorName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">Thanks for reaching out through ${directoryName}. Your inquiry has been sent to <strong>${data.businessName}</strong> — they'll be in touch with you directly.</p>

    <div style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:3px solid ${verticalConfig.primaryColor};border-radius:4px;font-size:14px;line-height:1.5;">
      <p style="margin:0 0 8px;font-weight:600;color:#374151;">What you sent</p>
      ${data.serviceNeeded ? `<p style="margin:0 0 4px;"><span style="color:#6b7280;">Service:</span> ${data.serviceNeeded}</p>` : ""}
      ${data.message ? `<p style="margin:0;"><span style="color:#6b7280;">Message:</span> ${data.message}</p>` : ""}
    </div>

    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">If you don't hear back soon, just reply to this email and we'll follow up.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
    <p style="font-size:11px;color:#9ca3af;margin:0;">Sent via ${directoryName} (${displayDomain}). You received this because you submitted an inquiry on our directory.</p>
  </div>
</div>`;

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: `${directoryName} <${FROM_ADDRESS}>`,
      to: data.visitorEmail,
      ...(data.businessEmail ? { replyTo: data.businessEmail } : {}),
      subject: `Your inquiry to ${data.businessName} has been sent`,
      html,
    });

    if (error) {
      console.error("Resend error (inquiry confirmation):", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("Resend exception (inquiry confirmation):", err);
    return { success: false, error: err.message };
  }
}


interface PitchForwardData {
  to: string; // the unclaimed business's deliverable (scraped) email
  businessName: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  message?: string;
  serviceNeeded?: string;
  urgency?: string;
  claimUrl?: string | null; // present => append the claim CTA (this makes the mail a CEM)
}

/**
 * Lead-to-Claim forward (TDL #472). Forwards a clean lead to an UNCLAIMED listing's
 * scraped email via Resend, optionally appending a CASL-compliant claim CTA.
 *
 * When `claimUrl` is set AND CASL_POSTAL_ADDRESS is configured, the mail is a CEM and
 * carries: sender ID (Smart Website Management + directory), a physical mailing address,
 * a visible unsubscribe link, and the List-Unsubscribe / List-Unsubscribe-Post headers.
 * If `claimUrl` is set but no postal address is configured, the pitch is downgraded to a
 * plain forward (fail-closed — never emit a non-compliant CEM).
 *
 * Returns { suppressedSmoke:true } for canary traffic (tdl47Ncanary / SMOKE_TEST=1) so
 * automated smoke proves the path without dispatching real mail (mirrors #455).
 */
export async function sendClaimPitchForward(
  data: PitchForwardData
): Promise<{ success: boolean; error?: string; pitched?: boolean; suppressedSmoke?: boolean }> {
  // Smoke suppression — never dispatch real mail for test traffic.
  if (
    /tdl47\dcanary|tdl455canary/i.test(data.visitorEmail || "") ||
    process.env.SMOKE_TEST === "1"
  ) {
    console.log(
      `[SMOKE] would-send: sendClaimPitchForward -> ${data.to} (pitch=${!!data.claimUrl}) (suppressed)`
    );
    return { success: true, pitched: !!data.claimUrl, suppressedSmoke: true };
  }

  const directoryName = verticalConfig.name;
  const domain = verticalConfig.domain;
  const displayDomain = verticalDomain();
  const postalAddress = (process.env.CASL_POSTAL_ADDRESS || "").trim();

  // A pitch (CEM) MUST carry a physical address. No address configured => downgrade to
  // a plain forward so we can never emit a non-compliant CEM (fail-closed).
  const pitch = !!data.claimUrl && postalAddress !== "";

  const urgencyBadge =
    data.urgency === "emergency"
      ? '<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">EMERGENCY</span>'
      : data.urgency === "urgent"
        ? '<span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">URGENT</span>'
        : '<span style="background:#6b7280;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">Flexible</span>';

  // QP-hardening: prefix the email value with a non-hex marker ("u-") so a recipient
  // address starting with 2 hex chars (admin@, feedback@, accounts@, …) can't be eaten by
  // quoted-printable transfer (=<2 hex> → byte), which would BREAK this CASL-required
  // unsubscribe link. The marker is stripped in /api/unsubscribe (^u- removes exactly the
  // one added here, so even a real "u-…"-prefixed address survives).
  const unsubUrl = `https://${domain}/api/unsubscribe?email=u-${encodeURIComponent(data.to)}&scope=pitch`;

  // CASL footer — only on a pitch (CEM). Sender ID + physical address + unsubscribe link.
  const caslFooterHtml = pitch
    ? `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 12px;" />
    <p style="font-size:11px;color:#9ca3af;margin:0 0 6px;line-height:1.5;">
      This message was sent by ${CASL_SENDER}, operator of ${directoryName} (${displayDomain}),
      because your business is listed in our public directory.
    </p>
    <p style="font-size:11px;color:#9ca3af;margin:0 0 6px;line-height:1.5;">${postalAddress}</p>
    <p style="font-size:11px;color:#9ca3af;margin:0;">
      <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
      &middot; you will receive no further claim emails at this address.
    </p>`
    : `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 12px;" />
    <p style="font-size:11px;color:#9ca3af;margin:0;">This lead was sent through ${directoryName} (${displayDomain}).</p>`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:${verticalConfig.primaryColor};padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">New Lead from ${directoryName}</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">${displayDomain}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;font-size:15px;">Hi <strong>${data.businessName}</strong>, you have a new lead!</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;color:#6b7280;width:120px;vertical-align:top;">Name</td><td style="padding:8px 0;font-weight:600;">${data.visitorName}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Email</td><td style="padding:8px 0;"><a href="mailto:${data.visitorEmail}" style="color:${verticalConfig.primaryColor};">${data.visitorEmail}</a></td></tr>
      ${data.visitorPhone ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Phone</td><td style="padding:8px 0;"><a href="tel:${data.visitorPhone}" style="color:${verticalConfig.primaryColor};">${data.visitorPhone}</a></td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Urgency</td><td style="padding:8px 0;">${urgencyBadge}</td></tr>
      ${data.serviceNeeded ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Service</td><td style="padding:8px 0;">${data.serviceNeeded}</td></tr>` : ""}
    </table>
    ${data.message ? `<div style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:3px solid ${verticalConfig.primaryColor};border-radius:4px;font-size:14px;line-height:1.5;">${data.message}</div>` : ""}
    <div style="margin-top:20px;">
      <a href="mailto:${data.visitorEmail}?subject=Re: Your inquiry on ${directoryName}" style="display:inline-block;padding:12px 24px;background:${verticalConfig.primaryColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Reply to ${data.visitorName} →</a>
    </div>
    ${pitch ? claimCtaHtml(data.claimUrl as string, directoryName) : ""}
    ${caslFooterHtml}
  </div>
</div>`;

  const textLines = [
    `New lead from ${directoryName} (${displayDomain})`,
    ``,
    `Name: ${data.visitorName}`,
    `Email: ${data.visitorEmail}`,
    data.visitorPhone ? `Phone: ${data.visitorPhone}` : "",
    data.serviceNeeded ? `Service: ${data.serviceNeeded}` : "",
    data.urgency ? `Urgency: ${data.urgency}` : "",
    data.message ? `\nMessage:\n${data.message}` : "",
  ].filter(Boolean);
  if (pitch) {
    textLines.push(claimCtaText(data.claimUrl as string, directoryName));
    textLines.push(
      "",
      "— — —",
      `Sent by ${CASL_SENDER}, operator of ${directoryName} (${displayDomain}), because your business is listed in our public directory.`,
      postalAddress,
      `Unsubscribe: ${unsubUrl}`
    );
  } else {
    textLines.push("", `This lead was sent through ${directoryName} (${displayDomain}).`);
  }
  const text = textLines.join("\n");

  // List-Unsubscribe headers only on a CEM (a pitch).
  const headers: Record<string, string> | undefined = pitch
    ? {
        "List-Unsubscribe": `<${unsubUrl}>, <mailto:${FROM_ADDRESS}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : undefined;

  try {
    // Self-contained client (not the repo's getResend() — some verticals export a
    // module-level `resend` const instead, so the helper name isn't portable; TDL #472).
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: `${directoryName} <${FROM_ADDRESS}>`,
      to: data.to,
      replyTo: data.visitorEmail,
      subject: `New lead from ${directoryName} — ${data.visitorName}`,
      html,
      text,
      ...(headers ? { headers } : {}),
    });
    if (error) {
      console.error("sendClaimPitchForward Resend error:", error);
      return { success: false, error: error.message, pitched: pitch };
    }
    return { success: true, pitched: pitch };
  } catch (err: any) {
    console.error("sendClaimPitchForward exception:", err);
    return { success: false, error: err?.message, pitched: pitch };
  }
}


/**
 * Owner-login magic link. Transport-migrated from Gmail SMTP (old lib/email.ts) to
 * Resend; subject + HTML body are preserved verbatim — only the transport changed.
 * Returns a structured result so callers can log the Resend id and never throw.
 */
export async function sendMagicLink(
  email: string,
  slug: string,
  token: string
): Promise<AuthSendResult> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const magicLink = `${baseUrl}/api/owner/auth?token=${token}&slug=${slug}`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: AUTH_FROM,
      to: email,
      subject: `Your login link for ${verticalConfig.name}`,
      html: `
      <h2>Welcome back to ${verticalConfig.name}</h2>
      <p>Click the link below to access your listing dashboard:</p>
      <p><a href="${magicLink}" style="display:inline-block;padding:12px 24px;background:${verticalConfig.primaryColor};color:white;text-decoration:none;border-radius:6px;">Access Dashboard</a></p>
      <p>Or copy this link: ${magicLink}</p>
      <p>This link will log you in and is valid for 30 days.</p>
      <p style="color:#666;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? "" };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

/**
 * Claim-verification email. Transport-migrated from Gmail SMTP (old lib/email.ts) to
 * Resend; subject + HTML body + the /api/claim/verify link convention are preserved
 * verbatim. Returns a structured result so callers can log the Resend id and never throw.
 */
export async function sendClaimEmail(
  email: string,
  slug: string,
  claimToken: string
): Promise<AuthSendResult> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const verifyLink = `${baseUrl}/api/claim/verify?token=${claimToken}&slug=${slug}`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: AUTH_FROM,
      to: email,
      subject: `Verify your claim on ${verticalConfig.name}`,
      html: `
      <h2>Claim Your Listing on ${verticalConfig.name}</h2>
      <p>Click the link below to verify your ownership claim:</p>
      <p><a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background:${verticalConfig.primaryColor};color:white;text-decoration:none;border-radius:6px;">Verify Claim</a></p>
      <p>Or copy this link: ${verifyLink}</p>
      <p style="color:#666;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    `,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? "" };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}


export async function sendAddBusinessEmail(email: string, slug: string, token: string, businessName: string): Promise<AuthSendResult> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const verifyLink = `${baseUrl}/api/claim/verify?token=${token}&slug=${slug}`;
  const name = businessName || "your business";
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: AUTH_FROM, to: email,
      subject: `Verify your ${verticalConfig.name} listing — magic link inside`,
      html: `<h2>Verify your ${verticalConfig.name} listing</h2><p>Thanks for adding <strong>${name}</strong> to ${verticalConfig.name}. Click below to verify your email and finish your listing. The link expires in 24 hours.</p><p><a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background:${verticalConfig.primaryColor};color:white;text-decoration:none;border-radius:6px;">Verify and continue</a></p><p>Or copy this link: ${verifyLink}</p><p style="color:#666;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>`,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? "" };
  } catch (err: any) { return { ok: false, error: err?.message ?? String(err) }; }
}
