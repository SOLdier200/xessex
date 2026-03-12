import Link from "next/link";
import type { Metadata } from "next";
import TopNav from "../components/TopNav";

export const metadata: Metadata = {
  title: "Terms of Service – Xessex",
  description: "Terms and conditions for using the Xessex platform.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 py-12">

      <h1 className="text-3xl font-bold mb-2">XESSEX — TERMS OF SERVICE</h1>
      <p className="text-sm text-gray-500 mb-8">Last Updated: February 2026</p>

      <div className="prose prose-invert max-w-none space-y-8 text-gray-300">
        <section>
          <p>
            Welcome to Xessex (&quot;Xessex,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Xessex website, services, features, and content (collectively, the &quot;Platform&quot;).
          </p>
          <p className="mt-3">
            By accessing or using Xessex, you agree to be legally bound by these Terms.
          </p>
          <p className="mt-3">
            If you do not agree, you must not use the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">1. Adult-Only Platform</h2>
          <p>Xessex is strictly for adults.</p>
          <p className="mt-3">By accessing the Platform, you represent and warrant that:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>You are at least eighteen (18) years of age or the age of majority in your jurisdiction, whichever is higher</li>
            <li>You have the legal capacity to enter into binding agreements</li>
            <li>You are accessing from a jurisdiction where adult content is lawful</li>
            <li>You will not permit minors to access the Platform</li>
          </ul>
          <p className="mt-3">Any access by minors is strictly prohibited.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">2. RTA Compliance</h2>
          <p>Xessex uses Restricted to Adults (RTA) labeling and tagging.</p>
          <p className="mt-3">Filtering software, parental controls, and operating systems may block the Platform accordingly.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">3. Third-Party Embedded Content</h2>
          <p>
            <strong className="text-white">Xessex does not produce, upload, host, or store adult video content.</strong>
          </p>
          <p className="mt-3">All media is embedded from third-party providers.</p>
          <p className="mt-3">Those providers are solely responsible for:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Age verification</li>
            <li>Consent verification</li>
            <li>Legal compliance</li>
            <li>Content moderation</li>
          </ul>
          <p className="mt-3">Xessex disclaims all liability related to third-party content.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">4. Wallet-Based Accounts</h2>
          <p>Your Solana wallet serves as your account identity.</p>
          <p className="mt-3">You agree that:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>You are solely responsible for wallet security</li>
            <li>You control all wallet activity</li>
            <li>Lost wallet access cannot be recovered by Xessex</li>
            <li>Xessex is not liable for wallet compromise</li>
          </ul>
          <p className="mt-3">All actions performed through your wallet are your responsibility.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">5. Special Credits and Token-Related Features</h2>
          <p>The Platform may provide loyalty-based digital credits (&quot;Credits&quot;).</p>
          <p className="mt-3">Credits:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Have no monetary value</li>
            <li>Are not currency</li>
            <li>Are not cryptocurrency</li>
            <li>Are not securities</li>
            <li>Cannot be transferred</li>
            <li>Cannot be sold</li>
            <li>Cannot be redeemed for money</li>
          </ul>
          <p className="mt-3">Credits exist solely as a platform loyalty system.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">6. XESS Tokens and Blockchain Disclaimer</h2>
          <p>Xessex may interact with blockchain tokens.</p>
          <p className="mt-3">You acknowledge:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Blockchain assets may lose value</li>
            <li>Blockchain transactions are irreversible</li>
            <li>Tokens are not investments</li>
            <li>Tokens do not represent ownership</li>
            <li>Tokens do not guarantee profit</li>
          </ul>
          <p className="mt-3">Xessex makes no financial guarantees.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">7. User Comments and Community Standards</h2>
          <p>Xessex supports lawful free expression.</p>
          <p className="mt-3">Adult language, explicit discussion, and controversial opinions are permitted.</p>
          <p className="mt-3">However, users may not post content that:</p>

          <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">Illegal Content</h3>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Violates any law</li>
            <li>Promotes illegal activity</li>
            <li>Exploits minors</li>
          </ul>

          <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">Violence and Threats</h3>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Threatens violence</li>
            <li>Promotes violence</li>
            <li>Encourages rape or assault</li>
          </ul>

          <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">Exploitation</h3>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Promotes non-consensual acts</li>
            <li>Engages in harassment</li>
            <li>Shares private personal information without consent</li>
          </ul>

          <h3 className="text-lg font-medium text-white/90 mt-4 mb-2">Fraud and Abuse</h3>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Impersonates others</li>
            <li>Attempts scams</li>
          </ul>

          <p className="mt-3">Xessex reserves the right to remove content at its sole discretion.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">8. Free Speech Position</h2>
          <p>Xessex does not remove lawful content solely because it is:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Offensive</li>
            <li>Explicit</li>
            <li>Controversial</li>
            <li>Vulgar</li>
            <li>Politically unpopular</li>
          </ul>
          <p className="mt-3">However, unlawful content is prohibited.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">9. Platform License</h2>
          <p>By posting comments, you grant Xessex a worldwide, perpetual, irrevocable, royalty-free license to use your content.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">10. Prohibited Conduct</h2>
          <p>You may not:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Access under age 18</li>
            <li>Hack or exploit the Platform</li>
            <li>Scrape content</li>
            <li>Interfere with operations</li>
            <li>Abuse systems</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">11. No Financial Relationship</h2>
          <p>You agree:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>You are not an employee</li>
            <li>You are not a contractor</li>
            <li>You are not entitled to compensation</li>
          </ul>
          <p className="mt-3">Credits and tokens are not wages.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">12. Platform Provided &quot;As-Is&quot;</h2>
          <p>Xessex is provided &quot;as-is.&quot;</p>
          <p className="mt-3">We make no guarantees regarding:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Availability</li>
            <li>Reliability</li>
            <li>Content accuracy</li>
          </ul>
          <p className="mt-3">Use at your own risk.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">13. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Xessex is not liable for:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>User content</li>
            <li>User conduct</li>
            <li>Financial loss</li>
            <li>Token loss</li>
            <li>Emotional harm</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">14. Indemnification</h2>
          <p>You agree to indemnify Xessex from claims arising from:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Your use</li>
            <li>Your content</li>
            <li>Your violations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">15. Account Termination</h2>
          <p>We may suspend or terminate access at any time. For any reason. Without notice.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">16. Law Enforcement Cooperation</h2>
          <p>We may cooperate with law enforcement, including disclosure of records when legally required.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">17. Copyright and DMCA Compliance</h2>
          <p>Xessex respects copyright law.</p>
          <p className="mt-3">
            If you believe content infringes copyright, contact: <a href="mailto:legal@xessex.me" className="text-pink-400 hover:underline">legal@xessex.me</a>
          </p>
          <p className="mt-3">We may remove content.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">18. Arbitration Agreement and Class Action Waiver</h2>
          <p>You agree that all disputes will be resolved through binding arbitration.</p>
          <p className="mt-3">You waive the right to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Jury trial</li>
            <li>Class action lawsuits</li>
          </ul>
          <p className="mt-3">Disputes will be resolved individually.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">19. Governing Law</h2>
          <p>These Terms are governed by United States law and applicable state law.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">20. Changes to Terms</h2>
          <p>We may update these Terms at any time. When we do, we will update the &quot;Last Updated&quot; date at the top of this page and notify all users via the platform messaging system.</p>
          <p className="mt-3">Continued use of the Platform after changes constitutes acceptance of the updated Terms.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">21. Contact</h2>
          <p>Legal Contact: <a href="mailto:legal@xessex.me" className="text-pink-400 hover:underline">legal@xessex.me</a></p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">22. Entire Agreement</h2>
          <p>These Terms represent the entire agreement between you and Xessex.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">23. Severability</h2>
          <p>If any provision is invalid, the remaining provisions remain in effect.</p>
        </section>
      </div>
      </div>
    </main>
  );
}
