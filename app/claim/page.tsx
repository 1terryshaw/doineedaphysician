import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "Claim Your Listing",
};

export default function ClaimLandingPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-3xl font-bold mb-4">Claim Your {verticalConfig.entity} Listing</h1>
      <p className="text-gray-600 mb-8">
        Find your {verticalConfig.listingNoun} in our directory and click
        &ldquo;Claim Listing&rdquo; to verify ownership and manage your page.
      </p>
      <Link
        href="/directory"
        className="inline-block px-6 py-3 rounded-lg text-white font-medium"
        style={{ backgroundColor: verticalConfig.primaryColor }}
      >
        Browse Directory
      </Link>
    </div>
  );
}
