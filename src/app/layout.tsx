import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import Providers from "./providers";
import { AgeGateEnforcer } from "./components/AgeGateEnforcer";
import { PageViewTracker } from "./components/PageViewTracker";
import IncognitoButton from "./components/IncognitoButton";
import { Toaster } from "sonner";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Earn Crypto Watching Videos – Xessex Adult Rewards Platform",
  description:
    "Watch premium adult videos and earn crypto rewards. Xessex is a private platform with weekly payouts, collections, and verified creators.",
  keywords: [
    "adult video platform",
    "watch porn earn crypto",
    "crypto porn platform",
    "adult crypto rewards",
    "premium adult videos",
  ],
  metadataBase: new URL("https://xessex.me"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "https://xessex.me",
    siteName: "Xessex",
    title: "Earn Crypto Watching Videos – Xessex Adult Rewards Platform",
    description:
      "Watch premium adult videos and earn crypto rewards. Xessex is a private platform with weekly payouts, collections, and verified creators.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Earn Crypto Watching Videos – Xessex Adult Rewards Platform",
    description:
      "Watch premium adult videos and earn crypto rewards. Xessex is a private platform with weekly payouts, collections, and verified creators.",
  },
  other: {
    "RATING": "RTA-5042-1996-1400-1577-RTA",
    "rating": "adult",
    "content-rating": "adult",
    "bingbot": "index,follow",
    "yandex-verification": "7f9ed63e6f0a5587",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <meta name="yandex-verification" content="7f9ed63e6f0a5587" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logos/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/logos/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/logos/favicon-16x16.png" />
        <link rel="manifest" href="/logos/site.webmanifest" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "AdultEntertainment",
              "name": "Xessex",
              "url": "https://xessex.me",
              "description": "Watch high-quality HD adult videos and earn crypto rewards for watching and grading content.",
              "publisher": {
                "@type": "Organization",
                "name": "Xessex"
              }
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Xessex",
              "url": "https://xessex.me",
              "description": "Premium adult platform with HD videos, top ranked content, and crypto rewards.",
              "audience": {
                "@type": "PeopleAudience",
                "suggestedMinAge": 18
              },
              "isFamilyFriendly": false
            })
          }}
        />
      </head>
      <body className="antialiased min-h-screen">
        <Suspense fallback={null}>
          <AgeGateEnforcer />
          <PageViewTracker />
        </Suspense>
        <Providers>{children}</Providers>
        <Toaster
          position="top-center"
          expand={true}
          richColors
          toastOptions={{
            style: {
              background: "rgba(0, 0, 0, 0.95)",
              border: "1px solid rgba(236, 72, 153, 0.4)",
              color: "#fff",
              backdropFilter: "blur(8px)",
              boxShadow: "0 0 20px rgba(236, 72, 153, 0.3)",
            },
            classNames: {
              success: "!bg-gradient-to-r !from-green-900/90 !to-emerald-900/90 !border-green-500/50",
              error: "!bg-gradient-to-r !from-red-900/90 !to-rose-900/90 !border-red-500/50",
              warning: "!bg-gradient-to-r !from-yellow-900/90 !to-amber-900/90 !border-yellow-500/50",
              info: "!bg-gradient-to-r !from-blue-900/90 !to-cyan-900/90 !border-blue-500/50",
              loading: "!bg-gradient-to-r !from-purple-900/90 !to-pink-900/90 !border-purple-500/50",
            },
          }}
        />
        <IncognitoButton />

        {/* Global Footer */}
        <footer className="mt-12 pt-6 border-t border-white/10 text-center text-sm text-white/50">
          <div className="flex flex-wrap justify-center items-center gap-4 mb-4 px-4">
            <Link href="/tokenomics" className="hover:text-white transition">
              Tokenomics
            </Link>
            <span>•</span>
            <Link href="/rewards-drawing" className="hover:text-white transition">
              Rewards Drawing
            </Link>
            <span>•</span>
            <Link href="/earn-crypto-watching-porn" className="hover:text-white transition">
              Earn Crypto Watching Porn
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-white transition">
              Terms & Conditions
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-white transition">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/parental-controls" className="hover:text-white transition">
              Parental Controls & Safety
            </Link>
            <span>•</span>
            <Link href="/2257" className="hover:text-white transition">
              18 U.S.C. §2257
            </Link>
            <span>•</span>
            <Link href="/refund-policy" className="hover:text-white transition">
              Refund & Cancellation Policy
            </Link>
            <span>•</span>
            <Link href="/contact" className="hover:text-white transition">
              Contact Us
            </Link>
            <span>•</span>
            <Link href="/leave" className="hover:text-white transition">
              Leave Site
            </Link>
          </div>

          {/* RTA + Age */}
          <div className="flex flex-col items-center mb-4 gap-1">
            <a
              href="https://www.rtalabel.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-80 hover:opacity-100 transition"
            >
              <img
                src="/logos/rta.gif"
                alt="RTA Verified"
                className="h-10 w-auto"
                loading="lazy"
              />
            </a>
            <span className="text-xs text-white/40 tracking-wide">
              18+ Only
            </span>
          </div>

          <p className="text-center">© {new Date().getFullYear()} Xessex. All rights reserved.</p>
          <p className="text-center mt-2 text-white/40">
            For any issues at all please email{" "}
            <a href="mailto:support@xessex.me" className="text-sky-400 hover:text-sky-300 transition">
              support@xessex.me
            </a>
          </p>

        </footer>
      </body>
    </html>
  );
}
