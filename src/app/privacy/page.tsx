import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – Xessex",
  description: "Privacy policy for using the Xessex platform.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
        ← Back to Home
      </Link>

      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

      <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Information We Collect</h2>
          <p>
            We collect minimal information necessary to operate this website:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Age verification confirmation (stored as a cookie)</li>
            <li>Basic analytics data (page views, referrer information)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Cookies</h2>
          <p>
            We use cookies to remember your age verification status. This cookie expires
            after 30 days. You can delete this cookie at any time through your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Third-Party Content</h2>
          <p>
            Videos embedded on this site are hosted by third-party platforms. These platforms
            may collect their own data according to their respective privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Data Sharing</h2>
          <p>
            We do not sell or share your personal information with third parties for
            marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
          <p>
            For privacy-related inquiries: <a href="mailto:legal@xessex.me" className="text-pink-400 hover:underline">legal@xessex.me</a>
          </p>
          <p className="mt-1">
            For general help: <a href="mailto:help@xessex.me" className="text-pink-400 hover:underline">help@xessex.me</a>
          </p>
        </section>

        <p className="text-sm text-gray-500 pt-6">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>
    </main>
  );
}
