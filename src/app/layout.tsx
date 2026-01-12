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
  title: "xessex",
  description: "Adults only content platform",
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
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
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
