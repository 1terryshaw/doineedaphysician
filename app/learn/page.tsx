import { Metadata } from "next";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "Types of Therapy",
  description:
    "Learn about different types of therapy — from talk therapy and CBT to couples counselling and EMDR.",
};

const therapyTypes = [
  {
    title: "Talk Therapy / Psychotherapy",
    emoji: "💬",
    description:
      "The most common form of therapy — you and a therapist have regular conversations about what's going on in your life. It's a safe, private space to work through feelings, patterns, and challenges at your own pace. No couch required.",
  },
  {
    title: "Cognitive Behavioral Therapy (CBT)",
    emoji: "🧠",
    description:
      "CBT helps you notice unhelpful thought patterns and replace them with healthier ones. It's practical, structured, and backed by decades of research — especially effective for anxiety, depression, and stress.",
  },
  {
    title: "Couples Counselling",
    emoji: "💑",
    description:
      "Whether you're navigating conflict, communication breakdowns, or just feeling disconnected, couples counselling gives you tools to understand each other better and strengthen your relationship.",
  },
  {
    title: "Family Therapy",
    emoji: "👨‍👩‍👧‍👦",
    description:
      "Family therapy brings family members together to work through conflicts, improve communication, and build healthier dynamics. It's especially helpful during major transitions or when one person's struggles affect the whole family.",
  },
  {
    title: "EMDR / Trauma Therapy",
    emoji: "🕊️",
    description:
      "EMDR (Eye Movement Desensitization and Reprocessing) helps your brain process traumatic memories so they lose their emotional charge. It's a well-researched approach for PTSD, anxiety, and unresolved trauma.",
  },
  {
    title: "Art & Creative Therapy",
    emoji: "🎨",
    description:
      "Creative therapies use art, music, drama, or movement as tools for expression and healing. You don't need to be artistic — it's about the process, not the product. Great for people who find it hard to put feelings into words.",
  },
];

export default function LearnPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-3 text-gray-900">Types of Therapy</h1>
      <p className="text-gray-600 mb-12 text-lg">
        Not sure what kind of therapy is right for you? Here&apos;s a quick, friendly guide to the
        most common approaches.
      </p>

      <div className="space-y-8">
        {therapyTypes.map((type) => (
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
          Ready to find a therapist near you?
        </h2>
        <Link
          href="/directory"
          className="inline-block px-8 py-3 rounded-lg font-semibold text-white transition-colors"
          style={{ backgroundColor: verticalConfig.ctaColor }}
        >
          Browse Therapists &rarr;
        </Link>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-12 text-center leading-relaxed">
        {verticalConfig.triageDisclaimer}
      </p>
    </div>
  );
}
