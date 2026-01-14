import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import Providers from "./providers";
import { AgeGateEnforcer } from "./components/AgeGateEnforcer";
import IncognitoButton from "./components/IncognitoButton";
import { Toaster } from "sonner";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Xessex – Premium Adult Video Membership",
  description:
    "Get paid to Watch and grade adult videos! Tired of skimming through 20 videos to find one that's High-Quality content? At Xessex, you can relax knowing anything you click is sought after content!",
  metadataBase: new URL("https://xessex.me"),
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
    title: "Xessex – Premium Adult Video Membership",
    description:
      "Get paid to Watch and grade adult videos! Tired of skimming through 20 videos to find one that's High-Quality content? At Xessex, you can relax knowing anything you click is sought after content!",
    siteName: "Xessex",
  },
  other: {
    "RATING": "RTA-5042-1996-1400-1577-RTA",
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
              "description": "Get paid to Watch and grade adult videos! Tired of skimming through 20 videos to find one that's High-Quality content? At Xessex, you can relax knowing anything you click is sought after content!",
              "publisher": {
                "@type": "Organization",
                "name": "Xessex"
              }
            })
          }}
        />
      </head>
      <body className="antialiased min-h-screen">
        <Suspense fallback={null}>
          <AgeGateEnforcer />
        </Suspense>
        <Providers>{children}</Providers>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#1a1a1a",
              border: "1px solid rgba(236, 72, 153, 0.3)",
              color: "#fff",
            },
          }}
        />
        <IncognitoButton />
      </body>
    </html>
  );
}
