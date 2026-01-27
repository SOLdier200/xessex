import type { Metadata } from "next";
import Link from "next/link";
import TopNav from "../components/TopNav";
import SignupClient from "./SignupClient";

export const metadata: Metadata = {
  title: "Create Your Xessex Account - Premium Adult Video Membership",
  description:
    "Sign up for Xessex membership to access premium HD adult videos, earn crypto rewards, and join an exclusive community. Choose Member or Diamond tier with flexible payment options.",
  keywords: [
    "xessex signup",
    "adult video membership",
    "premium porn subscription",
    "crypto adult platform",
    "earn crypto watching videos",
  ],
  openGraph: {
    title: "Create Your Xessex Account - Premium Adult Video Membership",
    description:
      "Sign up for Xessex membership to access premium HD adult videos, earn crypto rewards, and join an exclusive community.",
    url: "https://xessex.me/signup",
  },
  alternates: {
    canonical: "/signup",
  },
};

export default function SignupPage() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10">
        <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
          &larr; Back to Home
        </Link>

        {/* SEO Content - Server Rendered */}
        <section className="max-w-4xl mx-auto mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 text-center">
            Create Your Xessex Account
          </h1>

          <div className="text-white/80 space-y-4 mb-8">
            <p>
              Welcome to Xessex, the next-generation adult entertainment platform where you can watch
              premium HD videos and earn cryptocurrency rewards. Our curated collection features
              verified, high-quality content ranked by our community of members.
            </p>
            <p>
              Choose between two membership tiers: <strong className="text-pink-400">Member</strong> for
              full video access, or <strong className="text-yellow-400">Diamond</strong> for premium
              features including commenting, star ratings, and enhanced XESS token rewards.
            </p>
            <p>
              We accept cryptocurrency payments through NOWPayments, Cash App, and credit cards (coming soon).
              All transactions are secure and your privacy is protected.
            </p>
          </div>
        </section>

        {/* Interactive Signup Form - Client Rendered */}
        <SignupClient />

        {/* FAQ Section - Server Rendered for SEO */}
        <section className="max-w-4xl mx-auto mt-16 border-t border-white/10 pt-10">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <div className="bg-black/30 rounded-xl p-5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">
                What is Xessex?
              </h3>
              <p className="text-white/70">
                Xessex is a premium adult video platform that combines high-quality HD content with
                blockchain rewards. Members can watch curated videos and earn XESS tokens for
                participating in the community through voting, commenting, and engagement.
              </p>
            </div>

            <div className="bg-black/30 rounded-xl p-5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">
                What is the difference between Member and Diamond?
              </h3>
              <p className="text-white/70">
                <strong className="text-pink-400">Member</strong> tier gives you access to all videos
                and the ability to vote on comments. <strong className="text-yellow-400">Diamond</strong> tier
                includes everything in Member plus the ability to leave comments, give star ratings,
                and earn significantly more XESS token rewards each week.
              </p>
            </div>

            <div className="bg-black/30 rounded-xl p-5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">
                How do crypto rewards work?
              </h3>
              <p className="text-white/70">
                XESS is our native token on the Solana blockchain. Members earn XESS by engaging with
                content - voting on comments earns rewards, while Diamond members earn additional rewards
                for commenting and rating videos. Rewards are distributed weekly and can be claimed
                to any Solana wallet.
              </p>
            </div>

            <div className="bg-black/30 rounded-xl p-5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-white/70">
                We accept cryptocurrency payments (Bitcoin, Ethereum, Solana, and 100+ other coins)
                through NOWPayments, as well as Cash App payments. Credit card payments are coming soon.
                All payment methods are secure and private.
              </p>
            </div>

            <div className="bg-black/30 rounded-xl p-5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">
                Is my privacy protected?
              </h3>
              <p className="text-white/70">
                Yes. We take privacy seriously. Cryptocurrency payments are inherently private, and
                we never share your personal information with third parties. Your viewing history
                and account details are kept confidential. See our{" "}
                <Link href="/privacy" className="text-pink-400 hover:text-pink-300 underline">
                  Privacy Policy
                </Link>{" "}
                for details.
              </p>
            </div>

            <div className="bg-black/30 rounded-xl p-5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">
                Is there a free trial?
              </h3>
              <p className="text-white/70">
                Yes! New users can start a 14-day free trial of Member access. This gives you full
                access to all videos so you can experience the platform before committing to a
                paid subscription.
              </p>
            </div>

            <div className="bg-black/30 rounded-xl p-5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">
                What is your refund policy?
              </h3>
              <p className="text-white/70">
                We offer refunds on a case-by-case basis. If you are unsatisfied with your membership,
                please contact us within 7 days of purchase. See our{" "}
                <Link href="/refund-policy" className="text-pink-400 hover:text-pink-300 underline">
                  Refund Policy
                </Link>{" "}
                for complete details.
              </p>
            </div>

            <div className="bg-black/30 rounded-xl p-5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">
                How do I cancel my subscription?
              </h3>
              <p className="text-white/70">
                You can cancel your subscription at any time by contacting support at{" "}
                <a href="mailto:support@xessex.me" className="text-pink-400 hover:text-pink-300 underline">
                  support@xessex.me
                </a>.
                Your access will continue until the end of your current billing period.
              </p>
            </div>
          </div>

          {/* Legal Links */}
          <div className="mt-10 pt-6 border-t border-white/10 text-center text-sm text-white/50">
            <p className="mb-4">
              By creating an account, you confirm that you are at least 18 years old and agree to our{" "}
              <Link href="/terms" className="text-pink-400 hover:text-pink-300 underline">
                Terms of Service
              </Link>.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/privacy" className="hover:text-white transition">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-white transition">
                Terms & Conditions
              </Link>
              <span>•</span>
              <Link href="/refund-policy" className="hover:text-white transition">
                Refund Policy
              </Link>
              <span>•</span>
              <Link href="/parental-controls" className="hover:text-white transition">
                Parental Controls
              </Link>
              <span>•</span>
              <Link href="/2257" className="hover:text-white transition">
                18 U.S.C. §2257
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
