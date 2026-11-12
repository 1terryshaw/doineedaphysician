import type { Metadata } from "next";
import "./globals.css";
import verticalConfig from "@/lib/vertical.config";
import { SITE_URL, organizationSchema } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EmergencyBanner from "@/components/EmergencyBanner";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import UpgradeIntentCapture from "@/components/UpgradeIntentCapture"; // TDL #1391 (K432 rule 4)

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: verticalConfig.name,
    template: `%s | ${verticalConfig.name}`,
  },
  description: verticalConfig.description,
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
  },
  openGraph: {
    type: "website",
    siteName: verticalConfig.name,
    title: verticalConfig.name,
    description: verticalConfig.description,
    url: SITE_URL,
    images: [{ url: "https://doineedaphysician.com/og-share.png", width: 1200, height: 630, alt: "DoINeedAPhysician.com — Physician directory" }],
  },
  twitter: {
    card: "summary_large_image",
    title: verticalConfig.name,
    description: verticalConfig.description,
    images: ["https://doineedaphysician.com/og-share.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col font-sans">
        <UpgradeIntentCapture />
        <AnalyticsTracker />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
        />
        <EmergencyBanner />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
