/**
 * /claim-your-practice — public owner-initiated entry page.
 *
 * CANONICAL FILE. Copied byte-for-byte into each vertical repo. Do not edit per-repo copies.
 *
 * The page is PUBLIC.  The corpus behind it is NOT.  Everything rendered here is static
 * copy: there is no search, no autocomplete, no candidate list, no count, and no data
 * fetch of any kind — so there is nothing about a hidden organisation in the HTML, in
 * __NEXT_DATA__, or in any client bundle.
 *
 * When CLAIM_ENTRY_ENABLED is not set the page 404s, indistinguishable from a route that
 * does not exist.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import verticalConfig from "@/lib/vertical.config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Claim your practice | ${verticalConfig.name}`,
  description:
    "For owners and authorized representatives of a medical practice. Start the verification process for your organization.",
  robots: { index: false, follow: false },
};

export default function ClaimYourPracticePage() {
  if (process.env.CLAIM_ENTRY_ENABLED !== "1") notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Claim your practice</h1>

      <p className="mt-6 text-base leading-relaxed">
        This page is for the <strong>owner or an authorized representative</strong> of a medical
        practice or organization. It is not a search tool and it will not tell you whether a
        particular organization is listed.
      </p>

      <h2 className="mt-10 text-xl font-semibold">What you&apos;ll need</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed">
        <li>Your organization&apos;s NPI (a Type 2 organization NPI, not an individual clinician NPI)</li>
        <li>The practice&apos;s business phone number or postal code as they appear in official records</li>
        <li>Access to the practice&apos;s official phone line or business email domain</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold">What happens next</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed">
        <li>
          <strong>Submitting this form does not publish a listing.</strong> Nothing about your
          organization becomes visible as a result of filling it in.
        </li>
        <li>
          If the details match an eligible organization and the contact you provide can be verified,
          we&apos;ll send the next verification step to that contact.
        </li>
        <li>
          A listing is published <strong>only after</strong> verification succeeds — and only if it
          passes our publication checks.
        </li>
        <li>
          If your practice already has a public listing here, we&apos;ll route you to the normal
          claim process for it instead.
        </li>
        <li>
          We can&apos;t confirm or deny whether a specific organization is in our records before
          verification. That protects every practice, including yours.
        </li>
      </ul>

      <p className="mt-10 rounded-md border p-4 text-sm leading-relaxed">
        Verification is temporarily unavailable while we finish setting up a secure delivery channel
        for verification codes. We are not able to accept new claim requests through this page yet.
        If you need to reach us in the meantime, contact{" "}
        <a className="underline" href={`mailto:${verticalConfig.supportEmail}`}>
          {verticalConfig.supportEmail}
        </a>
        .
      </p>
    </main>
  );
}
