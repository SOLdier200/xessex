import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service – Xessex",
  description: "Terms and conditions for using the Xessex platform.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/age" className="text-gray-400 hover:text-white mb-6 inline-block">
        ← Back
      </Link>

      <h1 className="text-3xl font-bold mb-2">XESSEX — TERMS OF SERVICE</h1>
      <p className="text-sm text-gray-500 mb-8">Last Updated: January 2026</p>

      <div className="prose prose-invert max-w-none space-y-8 text-gray-300">
        <section>
          <p>
            Welcome to Xessex (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Xessex website, services, and any content made available through them (collectively, the &quot;Platform&quot;). By accessing or using Xessex, you agree to be bound by these Terms. If you do not agree, do not use the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">1. Adult-Only Platform</h2>
          <p>
            Xessex is strictly for adults. By accessing this Platform, you confirm that:
          </p>
          <ul className="list-disc list-inside mt-3 space-y-2">
            <li>You are at least eighteen (18) years of age or the age of majority in your jurisdiction</li>
            <li>You have the legal capacity to agree to these Terms</li>
            <li>You are accessing the Platform from a location where adult content is lawful</li>
            <li>You will not allow any minor to access or view this Platform</li>
          </ul>
          <p className="mt-3">
            Any attempt by a minor to access Xessex is strictly prohibited.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">2. RTA (Restricted to Adults) Compliance</h2>
          <p>
            Xessex is fully RTA (Restricted to Adults) compliant and maintains active RTA verification, including RTA tags and logos displayed across all pages of the Platform.
          </p>
          <p className="mt-3">
            This allows parental control software, ISPs, browsers, operating systems, and device-level filters to automatically block Xessex when adult filtering is enabled.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">3. Parental Responsibility</h2>
          <p>
            We are committed to protecting minors. However, parents and guardians are responsible for monitoring and controlling their children&apos;s internet access.
          </p>
          <p className="mt-3">We strongly encourage the use of:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Device-level parental controls (Windows, macOS, iOS, Android)</li>
            <li>ISP filtering services</li>
            <li>Third-party parental control software</li>
          </ul>
          <p className="mt-3">
            Xessex is designed to be blocked when these tools are enabled.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">4. Nature of the Content (Embedded Third-Party Media)</h2>
          <p>
            <strong className="text-white">Xessex does not host, store, or upload any adult content.</strong>
          </p>
          <p className="mt-3">
            All videos and media displayed on Xessex are embedded from third-party platforms, such as Pornhub and similar providers, which maintain their own content moderation systems, performer age-verification, consent verification, copyright compliance, and legal responsibilities.
          </p>
          <p className="mt-3">
            Xessex functions as an indexing and viewing interface that displays embedded media hosted and controlled entirely by third-party platforms.
          </p>
          <p className="mt-3">
            We do not control, produce, or upload the embedded content.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">5. No User Uploads</h2>
          <p>
            Users are not permitted to upload, submit, or distribute any content on Xessex under any circumstances.
          </p>
          <p className="mt-3">
            There are no user-generated videos, images, or uploads of any kind on this Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">6. Accounts & Access</h2>
          <p>
            Xessex is a wallet-native platform. Your connected Solana wallet serves as your identity.
          </p>
          <p className="mt-3">You agree that:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>You are responsible for securing your wallet and private keys</li>
            <li>You will not share or transfer your account access</li>
            <li>You are responsible for all activity under your wallet</li>
            <li>You will not attempt to bypass restrictions or exploit the platform</li>
          </ul>
          <p className="mt-3">
            We reserve the right to suspend or terminate access for misuse or violations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">7. Video Access & Unlocks</h2>
          <p>
            Access to certain videos may require spending Special Credits earned through platform participation.
          </p>
          <p className="mt-3">You agree that:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Special Credits have no monetary value and cannot be purchased or sold</li>
            <li>Video unlocks are permanent and non-refundable</li>
            <li>Access to unlocked content depends on third-party platform availability</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">8. Rewards Credits System</h2>
          <p>
            Users may earn non-transferable &quot;Special Credits&quot; (&quot;Credits&quot;) through participation in the Xessex platform, including but not limited to holding Xess tokens in a compatible wallet. Credits are issued solely as a loyalty reward and have no monetary value. Credits cannot be purchased, sold, traded, transferred, exchanged for cryptocurrency, exchanged for cash, or redeemed for any item of monetary value.
          </p>
          <p className="mt-3">
            Credits may only be redeemed for platform-specific benefits such as video unlocks or other non-monetary digital perks offered by the site. Credits do not represent any financial interest, ownership interest, or right to receive compensation of any kind.
          </p>

          <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">8.1 Reward Drawings</h3>
          <p>
            From time to time, the platform may offer optional reward drawings (&quot;Drawings&quot;) in which users may choose to spend Credits for a chance to receive additional Credits. Participation in Drawings is entirely optional. Drawings do not require payment, cryptocurrency, or any item of value to enter. Only Credits may be used to participate.
          </p>
          <p className="mt-3">
            Prizes awarded in Drawings consist exclusively of additional Credits, which retain the same non-monetary, non-transferable nature described above. Drawings do not provide cash, cryptocurrency, or any item of monetary value.
          </p>

          <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">8.2 No Gambling or Wagering</h3>
          <p>
            The platform does not offer gambling, wagering, or games of chance involving money, cryptocurrency, or items of value. Credits cannot be used as a substitute for money or cryptocurrency. Credits cannot be withdrawn, cashed out, or exchanged for anything of monetary value.
          </p>
          <p className="mt-3">
            All activities involving Credits are intended solely as loyalty rewards and entertainment features within the platform.
          </p>

          <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">8.3 No Financial Returns</h3>
          <p>
            Holding Xess tokens does not entitle users to financial returns, interest, dividends, staking rewards, or any form of passive income. Any Credits earned through holding Xess tokens are loyalty rewards and not financial compensation. Xess tokens are not investment products, and the platform does not promote them as such.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">9. Prohibited Conduct</h2>
          <p>You may not:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Access Xessex if under 18</li>
            <li>Share or resell access</li>
            <li>Copy, scrape, download, or redistribute content</li>
            <li>Attempt to bypass security or filters</li>
            <li>Interfere with platform operations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">10. Disclaimers</h2>
          <p>
            Xessex is provided &quot;as is.&quot; We do not guarantee uptime, availability, or accuracy of embedded third-party content.
          </p>
          <p className="mt-3">
            You use this Platform at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">11. Limitation of Liability</h2>
          <p>
            To the fullest extent allowed by law, Xessex is not liable for any damages arising from your use of the Platform, including exposure to adult content or third-party media.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">12. Termination</h2>
          <p>
            We may suspend or terminate access at any time for violations of these Terms or misuse.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">13. Changes to These Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of Xessex after changes means you accept the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">14. Contact</h2>
          <p>For legal, compliance, or support inquiries:</p>
          <p className="mt-2">
            <a href="mailto:support@xessex.me" className="text-pink-400 hover:underline">support@xessex.me</a>
          </p>
        </section>
      </div>
    </main>
  );
}
