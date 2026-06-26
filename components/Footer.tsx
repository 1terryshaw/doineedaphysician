import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import ShareButtons from "@/components/pizzazz/ShareButtons";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto" style={{ borderTop: `2px solid transparent`, borderImage: `linear-gradient(to right, ${verticalConfig.primaryColor}, transparent) 1` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">{verticalConfig.name}</h3>
            <p className="text-sm leading-relaxed">{verticalConfig.description}</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/directory" className="hover:text-white">
                  Directory
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/learn" className="hover:text-white">
                  Physician Specialties
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="hover:text-white">
                  Disclaimer
                </Link>
              </li>
            </ul>
          </div>

          {/* Crisis Resources */}
          <div>
            <h4 className="text-white font-semibold mb-4">Crisis Resources</h4>
            <ul className="space-y-2 text-sm">
              {verticalConfig.crisisResources.resources.map((r, idx) => (
                <li key={idx}>
                  {r.url ? (
                    <a href={r.url} className="hover:text-white">
                      {r.label}
                    </a>
                  ) : (
                    <span>{r.label}</span>
                  )}
                </li>
              ))}
            </ul>

            {/* Cross-referrals */}
            {verticalConfig.crossReferrals.length > 0 && (
              <div className="mt-6">
                <h4 className="text-white font-semibold mb-2 text-sm">Related Directories</h4>
                <ul className="space-y-1 text-sm">
                  {verticalConfig.crossReferrals.map((ref) => (
                    <li key={ref.url}>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white"
                      >
                        {ref.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <p className="text-xs text-gray-500 leading-relaxed mb-4 text-center">
            {verticalConfig.triageDisclaimer}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <p>
              &copy; {new Date().getFullYear()} {verticalConfig.name}. All
              rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Enjoying the site? Share it.</span>
              <ShareButtons variant="compact" title={verticalConfig.name} />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
