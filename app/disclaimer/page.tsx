import type { Metadata } from "next";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "Disclaimer & Terms of Use",
  description:
    "Disclaimer and terms of use for DoINeedAPhysician.com — a public physician directory. Not a medical referral service and not medical advice.",
  alternates: { canonical: "/disclaimer" },
};

export default function DisclaimerPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose prose-gray">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Disclaimer &amp; Terms of Use</h1>

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">Not a Medical Referral Service</h2>
      <p className="text-gray-700 leading-relaxed">
        DoINeedAPhysician.com is a public directory of licensed physicians compiled from publicly
        available state medical board records and the National Plan and Provider Enumeration System
        (NPPES). Inclusion in this directory does not constitute an endorsement, recommendation, or
        referral. We do not vet, evaluate, or verify the quality, competence, or current status of
        any practitioner listed.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">Not Medical Advice</h2>
      <p className="text-gray-700 leading-relaxed">
        This website provides directory information only. Nothing on this site constitutes medical
        advice, diagnosis, or treatment. Always seek the advice of a qualified physician or other
        healthcare provider with any questions you may have regarding a medical condition. Never
        disregard professional medical advice or delay seeking it because of information found on
        this site.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">Medical Emergencies</h2>
      <p className="text-gray-900 font-bold leading-relaxed">
        If you are experiencing a medical emergency, call 911 immediately or go to your nearest
        emergency room. Do not use this directory to locate emergency care.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">Accuracy of Listings</h2>
      <p className="text-gray-700 leading-relaxed">
        Listings are compiled from public records and may be incomplete, outdated, or contain
        errors. License status, practice location, contact information, specialties, and board
        certifications may have changed since data was last refreshed. Users are responsible for
        independently verifying any practitioner&apos;s current license status, credentials, and
        practice details before engaging their services. We recommend verifying license status
        directly with the relevant state medical board.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">Data Sources</h2>
      <p className="text-gray-700 leading-relaxed">Listings on this site are sourced from:</p>
      <ul className="list-disc ml-6 text-gray-700 leading-relaxed">
        <li>
          California Department of Consumer Affairs / Medical Board of California public licensee
          records
        </li>
        <li>
          National Plan and Provider Enumeration System (NPPES) — Centers for Medicare &amp;
          Medicaid Services
        </li>
        <li>Additional state medical board public records</li>
      </ul>
      <p className="text-gray-700 leading-relaxed">
        These are public, government-maintained records. This directory contains no protected health
        information (PHI). No information about patients is collected, stored, or displayed.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">
        Physician Listing Claims &amp; Corrections
      </h2>
      <p className="text-gray-700 leading-relaxed">
        Physicians and their authorized representatives may claim, correct, update, or request
        removal of their listing at no cost. Use the &ldquo;Claim Your Listing&rdquo; link or contact
        us via the contact page. We will respond to verified removal requests within 7 business days.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">
        Specialty &amp; Board Certification
      </h2>
      <p className="text-gray-700 leading-relaxed">
        Specialty designations shown reflect taxonomy codes from licensee records. They do not
        represent board certification unless explicitly stated. Verify board certification directly
        with the American Board of Medical Specialties (abms.org) or relevant specialty board.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">
        No Practitioner-Patient Relationship
      </h2>
      <p className="text-gray-700 leading-relaxed">
        Use of this directory does not create any practitioner-patient relationship between you and
        any physician listed, nor between you and DoINeedAPhysician.com.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">Limitation of Liability</h2>
      <p className="text-gray-700 leading-relaxed">
        DoINeedAPhysician.com and its operators are not liable for any decisions made based on
        information found on this site. Use of this directory is at your own risk.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">Contact</h2>
      <p className="text-gray-700 leading-relaxed">
        Questions, corrections, or removal requests:{" "}
        <a href={`mailto:${verticalConfig.supportEmail}`} className="underline">
          {verticalConfig.supportEmail}
        </a>
      </p>
    </div>
  );
}
