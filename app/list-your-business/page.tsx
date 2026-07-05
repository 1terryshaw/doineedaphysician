import type { Metadata } from "next";
import Link from "next/link";
import AddBusinessForm from "@/components/AddBusinessForm";
import verticalConfig from "@/lib/vertical.config";
export const metadata: Metadata = {
  title: `Add Your Business | ${verticalConfig.name}`,
  description: `Add your physician to ${verticalConfig.name} for free. Free Verified listing, takes about 2 minutes.`,
};
export default function ListYourBusinessPage() {
  return (
    <section className="bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-12"><div className="max-w-xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight" style={{ color: verticalConfig.primaryColor }}>Add your physician to {verticalConfig.name}</h1>
          <p className="text-lg text-gray-700">Free Verified listing. Takes about 2 minutes. We&rsquo;ll send you a magic link to manage it.</p>
        </header>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8"><AddBusinessForm /></div>
        <p className="text-center text-sm text-gray-600 mt-6">Already listed?{" "}
          <Link href="/pricing" className="font-medium underline" style={{ color: verticalConfig.primaryColor }}>Claim your existing listing &rarr;</Link></p>
      </div></div>
    </section>
  );
}
