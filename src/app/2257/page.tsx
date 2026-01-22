import Link from "next/link";

export default function Page2257() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
        ← Back to Home
      </Link>

      <h1 className="text-3xl font-bold mb-8">18 U.S.C. § 2257 Compliance Notice</h1>

      <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Exemption Statement</h2>
          <p>
            Xessex.me is not a producer (primary or secondary) of any visual content found on this website.
            All visual content is produced by third parties and is embedded or linked from third-party platforms.
          </p>
          <p className="mt-3">
            As such, Xessex.me is exempt from the record-keeping requirements of 18 U.S.C. § 2257 and 28 C.F.R. Part 75.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Third-Party Content</h2>
          <p>
            All videos displayed on this website are hosted by and embedded from third-party platforms.
            The operators of those platforms are responsible for maintaining all records required by 18 U.S.C. § 2257
            and its regulations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Content Removal</h2>
          <p>
            If you believe any content on this site violates your rights or applicable law, please contact us
            immediately at legal@xessex.me and we will promptly investigate and remove the content if appropriate.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Contact Information</h2>
          <p>
            For any legal inquiries regarding this compliance notice, please contact:
          </p>
          <p className="mt-2">
            Email: legal@xessex.me
          </p>
        </section>

        <p className="text-sm text-gray-500 pt-6">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>
    </main>
  );
}
