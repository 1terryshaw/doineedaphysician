import { Metadata } from "next";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${verticalConfig.name}.`,
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 27, 2026</p>

      <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Agreement to Terms</h2>
          <p>
            By accessing or using {verticalConfig.name} (the &ldquo;Service&rdquo;), operated by
            Smart Website Management (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;),
            owned by Terence Shaw, you agree to be bound by these Terms of Service. If you do not
            agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Description of Service</h2>
          <p>
            {verticalConfig.name} is a public directory of licensed physicians compiled from state
            medical board records and the National Plan and Provider Enumeration System (NPPES). It
            is not a medical referral service and does not provide medical advice. We offer free and
            paid listing tiers for physician practices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Not Medical Advice</h2>
          <p>
            The Service provides directory information only. Nothing on this site constitutes medical
            advice, diagnosis, or treatment, and inclusion of a physician is not an endorsement or
            referral. Always consult a qualified healthcare provider, and verify any physician&apos;s
            current license directly with the relevant state medical board. If you are experiencing a
            medical emergency, call 911. See our{" "}
            <a href="/disclaimer" className="underline">full disclaimer</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. User Accounts</h2>
          <p>
            When you claim a listing, you receive an authentication token via email. You are
            responsible for maintaining the confidentiality of your access credentials and for all
            activity under your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Listing Content</h2>
          <p>
            Listing owners are solely responsible for the accuracy of information they provide. We
            reserve the right to remove or modify listings that violate these terms, contain
            misleading information, or are otherwise inappropriate.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Payments and Subscriptions</h2>
          <p>
            Paid plans are billed monthly via Stripe. You may cancel at any time; access continues
            through the end of the billing period. Refunds are provided at our discretion.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Submit false or misleading listing information</li>
            <li>Scrape, crawl, or harvest data from the Service</li>
            <li>Interfere with the operation of the Service</li>
            <li>Impersonate another person or business</li>
            <li>Misrepresent professional credentials or qualifications</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Limitation of Liability</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; without warranties of any kind. Smart
            Website Management shall not be liable for any indirect, incidental, or consequential
            damages arising from your use of the Service. We do not guarantee the qualifications,
            competence, or suitability of any listed physician.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the Service after changes
            constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Contact</h2>
          <p>
            Questions about these Terms? Contact us at{" "}
            <a href={`mailto:${verticalConfig.supportEmail}`} className="underline">
              {verticalConfig.supportEmail}
            </a>
            .
          </p>
        </section>
      </div>

      <p className="text-xs text-gray-400 mt-12 leading-relaxed">
        {verticalConfig.triageDisclaimer}
      </p>
    </div>
  );
}
