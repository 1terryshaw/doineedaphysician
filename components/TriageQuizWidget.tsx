"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";

const MAJOR_CITIES = [
  { label: "Toronto", slug: "toronto" },
  { label: "Vancouver", slug: "vancouver" },
  { label: "Calgary", slug: "calgary" },
  { label: "Montreal", slug: "montreal" },
  { label: "Ottawa", slug: "ottawa" },
  { label: "Edmonton", slug: "edmonton" },
  { label: "Winnipeg", slug: "winnipeg" },
  { label: "Halifax", slug: "halifax" },
];

interface Answer {
  score: number;
  crisis?: boolean;
  type?: string;
}

type Step = "quiz" | "city" | "results" | "crisis";

export default function TriageQuizWidget() {
  const [step, setStep] = useState<Step>("quiz");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(Answer | null)[]>([null, null, null]);
  const [cityInput, setCityInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<{ label: string; slug: string } | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const questions = verticalConfig.triageQuestions;
  const totalQuestions = questions.length;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [step, currentQ]);

  function handleAnswer(answer: Answer) {
    const newAnswers = [...answers];
    newAnswers[currentQ] = answer;
    setAnswers(newAnswers);

    // Crisis check on Q1
    if (currentQ === 0 && answer.crisis) {
      setStep("crisis");
      return;
    }

    if (currentQ < totalQuestions - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setStep("city");
    }
  }

  function handleSkip() {
    const newAnswers = [...answers];
    newAnswers[currentQ] = { score: 2 };
    setAnswers(newAnswers);

    if (currentQ < totalQuestions - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setStep("city");
    }
  }

  function handleBack() {
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
    }
  }

  function handleCitySelect(city: { label: string; slug: string }) {
    setSelectedCity(city);
    setStep("results");
  }

  function handleCitySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cityInput.trim()) return;
    const slug = cityInput.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setSelectedCity({ label: cityInput.trim(), slug });
    setStep("results");
  }

  // Calculate results
  const q1Score = answers[0]?.score ?? 2;
  const q2Score = answers[1]?.score ?? 2;
  const totalScore = q1Score + q2Score;
  const therapistType = answers[2]?.type || "psychotherapist";

  const typeLabel =
    verticalConfig.categoryLabels.find((c) => c.slug === therapistType)?.label || "Therapist";

  let resultLevel: "low" | "moderate" | "high";
  if (totalScore <= 3) resultLevel = "low";
  else if (totalScore <= 6) resultLevel = "moderate";
  else resultLevel = "high";

  const result = verticalConfig.triageResults[resultLevel];
  const isHigh = resultLevel === "high";

  const ctaHref = selectedCity
    ? `/directory?listing_type=${therapistType}&region=${selectedCity.slug}`
    : `/directory?listing_type=${therapistType}`;

  function resetQuiz() {
    setStep("quiz");
    setCurrentQ(0);
    setAnswers([null, null, null]);
    setCityInput("");
    setSelectedCity(null);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        ref={containerRef}
        className="bg-white rounded-2xl shadow-lg overflow-hidden"
        style={{ maxHeight: "520px", overflowY: "auto" }}
      >
        {/* Crisis Screen */}
        {step === "crisis" && (
          <div className="p-6 md:p-8">
            <CrisisBox />
            <div className="mt-6 text-center">
              <p className="text-gray-600 mb-4">
                When you&apos;re ready, you can also find a therapist to talk to.
              </p>
              <button
                onClick={() => {
                  setStep("quiz");
                  setCurrentQ(1);
                }}
                className="px-6 py-3 rounded-lg font-semibold text-white transition-colors"
                style={{ backgroundColor: verticalConfig.primaryColor }}
              >
                Continue to Find a Therapist
              </button>
              <button
                onClick={resetQuiz}
                className="block mx-auto mt-3 text-sm text-gray-500 hover:text-gray-700"
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {/* Quiz Questions */}
        {step === "quiz" && (
          <div className="p-6 md:p-8">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-500">
                  Question {currentQ + 1} of {totalQuestions}
                </span>
                <button
                  onClick={handleSkip}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Skip
                </button>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentQ + 1) / totalQuestions) * 100}%`,
                    backgroundColor: verticalConfig.primaryColor,
                  }}
                />
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              {questions[currentQ].question}
            </h3>

            <div className="space-y-3">
              {questions[currentQ].options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    handleAnswer({
                      score: opt.score,
                      crisis: (opt as { crisis?: boolean }).crisis,
                      type: (opt as { type?: string }).type,
                    })
                  }
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all duration-200 group"
                >
                  <span className="font-medium text-gray-800 group-hover:text-gray-900">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>

            {currentQ > 0 && (
              <button
                onClick={handleBack}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                &larr; Back
              </button>
            )}
          </div>
        )}

        {/* City Selection */}
        {step === "city" && (
          <div className="p-6 md:p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Where are you looking for a therapist?
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Select a city or type your location below.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {MAJOR_CITIES.map((city) => (
                <button
                  key={city.slug}
                  onClick={() => handleCitySelect(city)}
                  className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:border-green-300 hover:bg-green-50 transition-colors"
                >
                  {city.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleCitySubmit} className="flex gap-2">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Type your city..."
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-300"
              />
              <button
                type="submit"
                className="px-6 py-2 rounded-lg font-semibold text-white transition-colors"
                style={{ backgroundColor: verticalConfig.ctaColor }}
              >
                Go
              </button>
            </form>

            <button
              onClick={handleBack}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              &larr; Back
            </button>
          </div>
        )}

        {/* Results */}
        {step === "results" && (
          <div className="p-6 md:p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">{result.heading}</h3>
            <p className="text-gray-600 mb-6">{result.body}</p>

            {/* CTA */}
            <Link
              href={ctaHref}
              className="block w-full text-center px-6 py-3 rounded-lg font-semibold text-white transition-colors mb-4"
              style={{
                backgroundColor:
                  result.ctaStyle === "primary"
                    ? verticalConfig.ctaColor
                    : verticalConfig.primaryColor,
              }}
            >
              Find a {typeLabel} in {selectedCity?.label || "your area"} &rarr;
            </Link>

            {/* High score: always show crisis resources */}
            {isHigh && (
              <div className="mb-6">
                <CrisisBox />
              </div>
            )}

            {/* Cross-referrals */}
            {verticalConfig.crossReferrals.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  You might also benefit from:
                </p>
                <div className="flex flex-wrap gap-2">
                  {verticalConfig.crossReferrals.map((ref) => (
                    <a
                      key={ref.url}
                      href={
                        selectedCity
                          ? `${ref.url}${ref.pathPattern?.replace("{city}", selectedCity.slug) ?? ""}`
                          : ref.url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700 transition-colors"
                    >
                      {ref.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-xs text-gray-400 mt-6 leading-relaxed">
              {verticalConfig.triageDisclaimer}
            </p>

            <button
              onClick={resetQuiz}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Take the check-in again
            </button>
          </div>
        )}
      </div>

      {/* Disclaimer below widget (always visible during quiz) */}
      {step === "quiz" && (
        <p className="text-xs text-gray-400 mt-3 text-center px-4 leading-relaxed">
          {verticalConfig.triageDisclaimer}
        </p>
      )}

      {/* FAQ Section */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {verticalConfig.faqs.map((faq, idx) => (
            <div key={idx} className="border rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 text-left font-medium text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>{faq.question}</span>
                <span className="text-gray-400 text-xl ml-4 flex-shrink-0">
                  {expandedFaq === idx ? "−" : "+"}
                </span>
              </button>
              {expandedFaq === idx && (
                <div className="px-4 pb-4 text-gray-600 text-sm leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CrisisBox() {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
      <h4 className="font-semibold text-red-800 mb-3 text-lg">
        You don&apos;t have to go through this alone
      </h4>
      <ul className="space-y-3">
        {verticalConfig.crisisResources.resources.map((r, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="text-red-500 mt-0.5">
              {r.type === "emergency" ? "🚨" : "📞"}
            </span>
            {r.url ? (
              <a
                href={r.url}
                className="text-red-800 font-medium hover:underline"
              >
                {r.label}
              </a>
            ) : (
              <span className="text-red-800 font-medium">{r.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
