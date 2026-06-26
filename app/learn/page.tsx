import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "Physician Specialties",
  description:
    "A quick guide to common physician specialties — from family medicine and internal medicine to cardiology, pediatrics, and surgery.",
};

const specialties = [
  {
    title: "Family Medicine",
    emoji: "🩺",
    description:
      "Family physicians provide primary care for patients of all ages — checkups, preventive care, common illnesses, and management of ongoing conditions. Often the first point of contact and a long-term partner in your health.",
  },
  {
    title: "Internal Medicine",
    emoji: "🫀",
    description:
      "Internists focus on adult medicine, including the prevention, diagnosis, and treatment of complex and chronic conditions. Many adults see an internist as their primary care physician.",
  },
  {
    title: "Pediatrics",
    emoji: "🧒",
    description:
      "Pediatricians care for infants, children, and adolescents — covering growth and development, immunizations, and childhood illnesses.",
  },
  {
    title: "Neurology",
    emoji: "⚡",
    description:
      "Neurologists diagnose and treat disorders of the brain, spine, and nervous system — including conditions such as stroke, epilepsy, migraine, and Parkinson's disease.",
  },
  {
    title: "Cardiology",
    emoji: "❤️",
    description:
      "Cardiologists specialize in the heart and cardiovascular system — diagnosing and treating conditions such as heart disease, arrhythmias, and high blood pressure.",
  },
  {
    title: "Surgery",
    emoji: "🏥",
    description:
      "Surgeons evaluate and, when appropriate, perform operative procedures. Specialties range from general surgery to orthopedics, neurosurgery, and many others.",
  },
];

export default function LearnPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-3 text-gray-900">Physician Specialties</h1>
      <p className="text-gray-600 mb-12 text-lg">
        Not sure which kind of physician to look for? Here&apos;s a quick guide to some common
        specialties. This is general information only — not medical advice.
      </p>

      <div className="space-y-8">
        {specialties.map((type) => (
          <div
            key={type.title}
            className="bg-white border rounded-xl p-6 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl flex-shrink-0">{type.emoji}</span>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{type.title}</h2>
                <p className="text-gray-600 leading-relaxed">{type.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Ready to find a physician near you?
        </h2>
        <Link
          href="/directory"
          className="inline-block px-8 py-3 rounded-lg font-semibold text-white transition-colors"
          style={{ backgroundColor: verticalConfig.ctaColor }}
        >
          Browse Physicians &rarr;
        </Link>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-12 text-center leading-relaxed">
        {verticalConfig.triageDisclaimer}
      </p>
    </div>
  );
}
