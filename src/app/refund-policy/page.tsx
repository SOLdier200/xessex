import Link from "next/link";

export const metadata = {
  title: "Refund & Cancellation Policy | Xessex",
  description: "Xessex refund and cancellation policy for memberships",
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
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Refund & Cancellation Policy
          </h1>
          <p className="text-sm text-white/50 mb-6">(CCBill Transactions)</p>

          <div className="space-y-8 text-white/80">
            {/* Intro */}
            <section>
              <p className="text-sm">
                Subscriptions purchased through our credit-card processor (CCBill) provide
                immediate access to age-restricted digital content upon successful payment
                authorization.
              </p>
              <p className="text-sm mt-3">
                Because access is delivered instantly, all sales are final once access has
                been granted, except where required by law or explicitly stated below.
              </p>
            </section>

            {/* Cancellation */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Cancellation</h2>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li>Subscriptions may be canceled at any time</li>
                <li>Cancellation prevents future rebilling</li>
                <li>Access remains active until the end of the current paid billing period</li>
                <li>No partial refunds are issued for unused time</li>
              </ul>
            </section>

            {/* Refunds */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Refunds</h2>
              <div className="space-y-3 text-sm">
                <p>Refunds are not guaranteed and are granted solely at our discretion.</p>
                <p>Refunds may be considered only if:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>A duplicate charge occurred due to a processing error</li>
                  <li>A billing error is verifiably attributable to our system</li>
                  <li>A purchase was accidental and no meaningful access to premium content occurred</li>
                </ul>
                <p className="text-yellow-400/90 mt-4">
                  All refund requests must be submitted within 24 hours of the original transaction.
                </p>
              </div>
            </section>

            {/* Non-Refundable */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Non-Refundable Circumstances</h2>
              <div className="space-y-3 text-sm">
                <p>Refunds will not be issued for:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Failure to cancel before the rebill date</li>
                  <li>Dissatisfaction with content</li>
                  <li>
                    Inability to access embedded third-party content due to device, ISP, VPN,
                    or jurisdictional restrictions
                  </li>
                  <li>Account termination for Terms of Service violations</li>
                  <li>Charges that were successfully authorized and delivered access</li>
                </ul>
              </div>
            </section>

            {/* Chargebacks */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Chargebacks</h2>
              <div className="space-y-3 text-sm">
                <p>Initiating a chargeback without first contacting support may result in:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Immediate suspension of access</li>
                  <li>Permanent account termination</li>
                  <li>Restriction from future purchases</li>
                </ul>
                <p className="mt-3">
                  Users are encouraged to contact support prior to filing any dispute.
                </p>
              </div>
            </section>

            {/* Billing Descriptor */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Billing Descriptor</h2>
              <p className="text-sm">
                Charges will appear on your statement under a billing descriptor provided by
                CCBill, which may differ slightly from the site name.
              </p>
            </section>

            {/* Support Contact */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Support Contact</h2>
              <div className="text-sm">
                <p>All billing inquiries must be directed to:</p>
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
