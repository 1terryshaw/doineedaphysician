import { Metadata } from "next";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${verticalConfig.name}.`,
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 27, 2026</p>

      <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Introduction</h2>
          <p>
            Smart Website Management (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;)
            operates {verticalConfig.name}. This Privacy Policy explains how we collect, use, and
            protect your information when you use our Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
          <p>We may collect the following information:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>
              <strong>Listing owners:</strong> Email address, business name, phone number, and
              listing details you provide when claiming or managing a listing.
            </li>
            <li>
              <strong>Visitors:</strong> Inquiry form submissions including name, email, and message
              content.
            </li>
            <li>
              <strong>Automatically collected:</strong> Browser type, IP address, pages visited, and
              cookies for session management.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. No Patient or Health Information</h2>
          <p>
            This is a directory of publicly listed physicians. <strong>We do not collect, store, or
            display any patient information or protected health information (PHI).</strong> Listings
            are compiled from public government records (state medical boards and NPPES).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. How We Use Your Information</h2>
          <p>We use collected information to:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Operate and maintain the directory</li>
            <li>Process listing claims and subscriptions</li>
            <li>Forward inquiries to listing owners</li>
            <li>Send service-related communications</li>
            <li>Improve the Service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li><strong>Supabase</strong> — database and authentication</li>
            <li><strong>Stripe</strong> — payment processing</li>
            <li><strong>Gmail SMTP</strong> — transactional email</li>
          </ul>
          <p className="mt-2">
            These services have their own privacy policies governing their use of your data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Cookies</h2>
          <p>
            We use cookies solely for authentication and session management. We do not use tracking
            or advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data Retention</h2>
          <p>
            We retain your data for as long as your account or listing is active. You may request
            deletion of your data by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Data Security</h2>
          <p>
            We implement reasonable security measures to protect your information. However, no method
            of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal information at
            any time by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Crisis Resources</h2>
          <p>
            If you or someone you know is in crisis, please reach out to one of these resources:
          </p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            {verticalConfig.crisisResources.resources.map((r, idx) => (
              <li key={idx}>
                {r.url ? (
                  <a href={r.url} className="underline">
                    {r.label}
                  </a>
                ) : (
                  <span>{r.label}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page
            with an updated date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Contact</h2>
          <p>
            Questions about this policy? Contact us at{" "}
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
