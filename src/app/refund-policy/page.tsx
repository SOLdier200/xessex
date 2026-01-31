import Link from "next/link";

export const metadata = {
  title: "Refund & Cancellation Policy | Xessex",
  description: "Xessex refund and cancellation policy",
};

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>

        <div className="neon-border rounded-2xl p-6 md:p-8 bg-black/30">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">
            Refund & Cancellation Policy
          </h1>

          <div className="space-y-8 text-white/80">
            {/* Intro */}
            <section>
              <p className="text-sm">
                Xessex is a wallet-native platform with no paid subscriptions or memberships.
                Access is granted through wallet authentication and participation in the platform.
              </p>
            </section>

            {/* No Paid Services */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">No Paid Services</h2>
              <p className="text-sm">
                Since Xessex does not charge for memberships or subscriptions, there are no
                payments to refund. All platform features are accessed through your connected
                wallet and earned Special Credits.
              </p>
            </section>

            {/* Special Credits */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Special Credits</h2>
              <p className="text-sm">
                Special Credits are earned through platform participation and holding XESS tokens.
                Credits have no monetary value and cannot be purchased, sold, or refunded.
                Credits may be used for video unlocks and platform features.
              </p>
            </section>

            {/* Support Contact */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Support Contact</h2>
              <div className="text-sm">
                <p>For any questions or concerns:</p>
                <div className="mt-3 p-4 bg-black/40 rounded-xl">
                  <a
                    href="mailto:support@xessex.me"
                    className="text-sky-400 hover:underline text-lg font-medium"
                  >
                    support@xessex.me
                  </a>
                  <p className="mt-2 text-white/50 text-xs">Response time: Within 24 hours</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
