import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Whitepaper v1.0 | Xessex",
  description: "XESSEX WHITEPAPER v1.0 - A Wallet-Native Curation Network for Video Content",
};

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Image
              src="/logos/mainsitelogo.png"
              alt="Xessex"
              width={285}
              height={95}
              className="h-[240px] w-auto"
              priority
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          XESSEX WHITEPAPER v1.0
        </h1>
        <p className="text-xl text-white/70 mb-8">A Wallet-Native Curation Network for Video Content</p>

        <nav className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Table of Contents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <a href="#abstract" className="text-cyan-400 hover:text-cyan-300">1. Abstract</a>
            <a href="#problem" className="text-cyan-400 hover:text-cyan-300">2. Problem Statement</a>
            <a href="#solution" className="text-cyan-400 hover:text-cyan-300">3. Solution Overview</a>
            <a href="#architecture" className="text-cyan-400 hover:text-cyan-300">4. Architecture & Data Model</a>
            <a href="#access" className="text-cyan-400 hover:text-cyan-300">5. Access Control & Unlock System</a>
            <a href="#credits" className="text-cyan-400 hover:text-cyan-300">6. Special Credits System</a>
            <a href="#rewards" className="text-cyan-400 hover:text-cyan-300">7. Rewards Mechanism</a>
            <a href="#tokenomics" className="text-cyan-400 hover:text-cyan-300">8. Tokenomics</a>
            <a href="#governance" className="text-cyan-400 hover:text-cyan-300">9. Governance</a>
            <a href="#security" className="text-cyan-400 hover:text-cyan-300">10. Security & Risk</a>
            <a href="#roadmap" className="text-cyan-400 hover:text-cyan-300">11. Roadmap</a>
            <a href="#legal" className="text-cyan-400 hover:text-cyan-300">12. Legal Positioning</a>
            <a href="#conclusion" className="text-cyan-400 hover:text-cyan-300">13. Conclusion</a>
          </div>
        </nav>

        <div className="space-y-8">
          {/* Section 1: Abstract */}
          <section id="abstract" className="bg-gray-900/50 border border-blue-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-blue-300">1. Abstract</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p>
                Xessex is a decentralized, wallet-native platform designed to solve one of the internet&apos;s most persistent problems: how to reliably curate, rank, and evaluate video content without relying on fragile payment systems, subscriptions, or centralized algorithms.
              </p>
              <p>The platform introduces a new model where:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>access is earned, not sold</li>
                <li>users are rewarded for participation quality</li>
                <li>progression is governed by internal credits</li>
                <li>rewards are settled on-chain</li>
                <li>identity is wallet-native</li>
                <li>the system survives independent of token price or payments</li>
              </ul>
              <p>
                Xessex launches with a fixed-supply token (XESS), already minted on mainnet, used exclusively for rewards and progression qualification — not for access, payments, or purchases.
              </p>
            </div>
          </section>

          {/* Section 2: Problem Statement */}
          <section id="problem" className="bg-gray-900/50 border border-purple-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-purple-300">2. Problem Statement</h2>

            <h3 className="text-lg font-semibold text-white mt-4 mb-2">2.1 The Collapse of Payment-Based Platforms</h3>
            <div className="text-white/70 leading-relaxed space-y-2">
              <p>Most video platforms fail for predictable reasons:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>payment processors restrict adult content</li>
                <li>chargebacks destroy margins</li>
                <li>subscriptions create churn</li>
                <li>centralized algorithms bias discovery</li>
                <li>creators are underpaid</li>
                <li>users are exploited for data</li>
              </ul>
              <p>In adult and creator ecosystems, these problems are existential, not just operational.</p>
            </div>

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">2.2 The Curation Crisis</h3>
            <div className="text-white/70 leading-relaxed space-y-2">
              <p>Algorithms cannot accurately measure quality:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Likes are shallow</li>
                <li>Views are gamed</li>
                <li>Bots dominate</li>
                <li>Engagement is noisy</li>
                <li>Feedback lacks context</li>
              </ul>
              <p>What platforms actually need is structured human curation, but human curation is expensive, slow, and hard to scale.</p>
            </div>

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">2.3 Why Web2 Solutions Fail</h3>
            <div className="text-white/70 leading-relaxed space-y-2">
              <p>Web2 platforms rely on: advertising, subscriptions, hidden algorithms, centralized moderation, opaque incentives.</p>
              <p>These systems collapse under: regulatory pressure, platform bans, creator revolts, payment shutdowns.</p>
            </div>

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">2.4 The Opportunity</h3>
            <div className="text-white/70 leading-relaxed">
              <p>There is a clear gap for a system that:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>uses humans to curate</li>
                <li>rewards quality participation</li>
                <li>avoids payments entirely</li>
                <li>scales without custody</li>
                <li>is legally defensible</li>
                <li>aligns users long-term</li>
              </ul>
              <p className="mt-2 font-semibold text-white/90">Xessex is designed to fill that gap.</p>
            </div>
          </section>

          {/* Section 3: Solution Overview */}
          <section id="solution" className="bg-gray-900/50 border border-cyan-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-cyan-300">3. Solution Overview</h2>

            <h3 className="text-lg font-semibold text-white mt-4 mb-2">3.1 Wallet-Native Identity</h3>
            <div className="text-white/70 leading-relaxed space-y-2">
              <p>Xessex uses cryptographic wallets as identity:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>No passwords</li>
                <li>No accounts to manage</li>
                <li>No PII required</li>
                <li>No custody</li>
                <li>No lock-in</li>
              </ul>
              <p>A wallet signature creates and authenticates a user account. This identity is used consistently across rewards, access, and progression.</p>
            </div>

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">3.2 Earned Access Model</h3>
            <div className="text-white/70 leading-relaxed space-y-2">
              <p>Xessex does not sell access. Instead:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>users start with a fixed starter set of videos</li>
                <li>users earn Special Credits through participation and holding behavior</li>
                <li>credits unlock additional content to curate</li>
                <li>unlocks expand earning potential</li>
              </ul>
              <p className="font-semibold text-white/90">Access is a function of contribution, not money.</p>
            </div>

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">3.3 Two-Layer Utility System</h3>
            <div className="text-white/70 leading-relaxed space-y-2">
              <p>The platform intentionally separates utility:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-black/40 rounded-xl p-4 border border-yellow-400/20">
                  <div className="font-semibold text-yellow-400 mb-2">XESS (On-chain)</div>
                  <ul className="text-sm space-y-1">
                    <li>weekly rewards</li>
                    <li>progression qualification</li>
                    <li>alignment</li>
                    <li>future governance</li>
                  </ul>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-cyan-400/20">
                  <div className="font-semibold text-cyan-400 mb-2">Special Credits (Off-chain)</div>
                  <ul className="text-sm space-y-1">
                    <li>unlock additional videos</li>
                    <li>unlock owned content</li>
                  </ul>
                </div>
              </div>
              <p className="mt-4">This separation removes regulatory risk while maintaining strong incentives.</p>
            </div>

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">3.4 Reward Engine (Non-Custodial)</h3>
            <div className="text-white/70 leading-relaxed space-y-2">
              <p>Users earn rewards continuously based on: ratings, comments, comment voting, participation, referrals.</p>
              <p>Rewards are:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>accumulated off-chain</li>
                <li>settled weekly</li>
                <li>distributed via Merkle proofs</li>
                <li>claimed on-chain</li>
                <li>never custodied by Xessex</li>
              </ul>
            </div>

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">3.5 Platform Independence</h3>
            <div className="text-white/70 leading-relaxed">
              <p>The platform is designed so that:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>it functions even if token price drops</li>
                <li>it functions without selling access</li>
                <li>it functions without payment processors</li>
                <li>it functions without subscriptions</li>
              </ul>
              <p className="mt-2 font-semibold text-white/90">This makes Xessex structurally durable.</p>
            </div>
          </section>

          {/* Section 4: Architecture */}
          <section id="architecture" className="bg-gray-900/50 border border-green-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-green-300">4. Architecture & Data Model</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p>Xessex is designed as a modular, wallet-native platform with strict separation between identity, access, rewards, and settlement.</p>

              <h3 className="text-lg font-semibold text-white mt-4 mb-2">4.1 System Architecture Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                  <div className="font-semibold text-white mb-2">1. Client Layer (Frontend)</div>
                  <ul className="text-sm space-y-1">
                    <li>Next.js application</li>
                    <li>Wallet connection & signature</li>
                    <li>Content rendering</li>
                    <li>Unlock UI</li>
                  </ul>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                  <div className="font-semibold text-white mb-2">2. Application Layer (API)</div>
                  <ul className="text-sm space-y-1">
                    <li>Auth & session management</li>
                    <li>Access checks</li>
                    <li>Unlock transactions</li>
                    <li>Reward aggregation</li>
                  </ul>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                  <div className="font-semibold text-white mb-2">3. Data Layer (Database)</div>
                  <ul className="text-sm space-y-1">
                    <li>User state</li>
                    <li>Unlock records</li>
                    <li>Credit ledger</li>
                    <li>Reward events</li>
                  </ul>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                  <div className="font-semibold text-white mb-2">4. Settlement Layer (Blockchain)</div>
                  <ul className="text-sm space-y-1">
                    <li>Merkle root publication</li>
                    <li>Reward claims</li>
                    <li>Token transfers</li>
                    <li>Non-custodial settlement</li>
                  </ul>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">4.2 Identity Model</h3>
              <p>Identity is wallet-native. A cryptographic signature creates the account. Wallet address is the primary key. No passwords are required. Email is optional and used only for recovery.</p>
              <p>This model dramatically reduces: fraud, Sybil attacks, support burden, account farming.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">4.4 Design Philosophy</h3>
              <p>Xessex uses explicit state over implicit assumptions:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access is recorded, not inferred</li>
                <li>Credits are ledgered, not recalculated</li>
                <li>Rewards are frozen, not mutable</li>
                <li>Settlement is verifiable, not trusted</li>
              </ul>
            </div>
          </section>

          {/* Section 5: Access Control */}
          <section id="access" className="bg-gray-900/50 border border-orange-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-orange-300">5. Access Control & Unlock System</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p className="font-semibold text-white/90">The unlock system is the core innovation of Xessex. Instead of selling access or using memberships, Xessex treats access as earned work capacity.</p>

              <h3 className="text-lg font-semibold text-white mt-4 mb-2">5.1 Starter Access</h3>
              <p>All users who connect a wallet receive access to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>10 starter videos</li>
                <li>chosen by rank</li>
                <li>free to view and curate</li>
                <li>eligible for rewards</li>
              </ul>
              <p>This guarantees: fair onboarding, equal starting point, no paywalls, no discrimination by wealth.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">5.2 Unlocking Additional Videos</h3>
              <p>Additional videos are locked by default. Unlock rules:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>cost: 100 Special Credits</li>
                <li>unlocks are permanent</li>
                <li>unlocks expand earning capacity</li>
                <li>unlocks are per-user, non-transferable</li>
              </ul>
              <p className="font-semibold text-white/90">Users unlock work opportunities, not entertainment.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">5.3 Unlocking Xessex-Owned Content</h3>
              <p>Xessex-owned content is a premium tier:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>fully owned by Xessex</li>
                <li>AI-generated or licensed</li>
                <li>higher reward weighting</li>
                <li>cost: 1,000 Special Credits</li>
              </ul>
              <p>This creates a natural progression ladder: Starter → Video Expansion → Owned Content</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">5.5 Engagement Integrity</h3>
              <p>Users may only rate, comment, and vote on videos they have unlocked. This prevents: farming, spam, automated abuse, reward inflation.</p>
            </div>
          </section>

          {/* Section 6: Special Credits */}
          <section id="credits" className="bg-gray-900/50 border border-pink-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-pink-300">6. Special Credits System</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p className="font-semibold text-white/90">Special Credits are internal progression points, not currency. They exist solely to control access expansion.</p>

              <h3 className="text-lg font-semibold text-white mt-4 mb-2">6.1 Credit Properties</h3>
              <p>Special Credits are:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>non-transferable</li>
                <li>non-purchasable</li>
                <li>non-withdrawable</li>
                <li>internal-only</li>
                <li>integer-based</li>
                <li>ledgered</li>
              </ul>
              <p className="font-semibold text-white/90">They have no monetary value and cannot be traded.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">6.2 Earning Credits</h3>
              <p>Credits are earned by:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>holding ≥ 10,000 XESS</li>
                <li>remaining qualified over time</li>
                <li>participating consistently</li>
              </ul>
              <p>Credits accrue daily once qualified. This creates: holding incentive, long-term alignment, stable progression, reduced churn.</p>
            </div>
          </section>

          {/* Section 7: Rewards */}
          <section id="rewards" className="bg-gray-900/50 border border-yellow-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-yellow-300">7. Rewards Mechanism</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p>The reward system is designed to incentivize high-quality curation, not raw activity. It is structured, auditable, and non-custodial.</p>

              <h3 className="text-lg font-semibold text-white mt-4 mb-2">7.1 Rewardable Actions</h3>
              <p>Users generate reward events through:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>video ratings (5-star system)</li>
                <li>written comments</li>
                <li>comment voting (likes/dislikes)</li>
                <li>participation consistency</li>
                <li>referrals</li>
                <li>weekly participation bonus</li>
                <li>special drawings</li>
              </ul>
              <p>Each action creates a RewardEvent record, not an immediate payout.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">7.2 Quality Weighting</h3>
              <p>Not all actions are equal. Reward weighting considers: engagement depth, community response, admin moderation adjustments, video type (owned content weighted higher), historical signal quality.</p>
              <p>This prevents spam and encourages thoughtful contributions.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">7.3 Weekly Settlement</h3>
              <p>Rewards are settled once per week:</p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>Reward events are frozen</li>
                <li>Totals are aggregated per user</li>
                <li>A Merkle tree is generated</li>
                <li>Merkle root is published</li>
                <li>Users claim rewards on-chain</li>
              </ol>
              <p>This batching model: reduces gas costs, enables scaling, keeps rewards verifiable, avoids custody risk.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">7.4 Claiming Rewards</h3>
              <p>Users claim rewards directly: from their wallet, on Solana, using a Merkle proof, without Xessex holding funds.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">7.5 Drawings Pool</h3>
              <p>5% of total supply is reserved for reward drawings.</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>weekly claim</li>
                <li>participation-based eligibility</li>
                <li>no paid entry</li>
                <li>no randomness for sale</li>
                <li>transparent rules</li>
              </ul>
              <p className="mt-3">This increases:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>retention</li>
                <li>excitement</li>
                <li>long-term engagement</li>
              </ul>
            </div>
          </section>

          {/* Section 8: Tokenomics */}
          <section id="tokenomics" className="bg-gray-900/50 border border-emerald-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-emerald-300">8. Tokenomics (Final)</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p className="font-semibold text-white/90">XESS is a fixed-supply utility token, already minted on mainnet.</p>
              <div className="bg-black/40 rounded-xl p-4 border border-emerald-400/30 mb-4">
                <p><strong>Total Supply:</strong> 1,000,000,000 XESS</p>
                <p><strong>Minting:</strong> Disabled permanently</p>
                <p><strong>Network:</strong> Solana Mainnet</p>
              </div>

              <h3 className="text-lg font-semibold text-white mt-4 mb-2">8.1 Allocation</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-white/10 rounded-xl overflow-hidden">
                  <thead className="bg-black/40">
                    <tr>
                      <th className="text-left py-2 px-3">Allocation</th>
                      <th className="text-right py-2 px-3">%</th>
                      <th className="text-right py-2 px-3">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-white/10"><td className="py-2 px-3">Private Presale</td><td className="text-right py-2 px-3">20%</td><td className="text-right py-2 px-3">200,000,000</td></tr>
                    <tr className="border-t border-white/10"><td className="py-2 px-3">Public Sale</td><td className="text-right py-2 px-3">15%</td><td className="text-right py-2 px-3">150,000,000</td></tr>
                    <tr className="border-t border-white/10"><td className="py-2 px-3">Liquidity Pools</td><td className="text-right py-2 px-3">15%</td><td className="text-right py-2 px-3">150,000,000</td></tr>
                    <tr className="border-t border-white/10"><td className="py-2 px-3">Rewards Emissions</td><td className="text-right py-2 px-3">20%</td><td className="text-right py-2 px-3">200,000,000</td></tr>
                    <tr className="border-t border-white/10"><td className="py-2 px-3">Rewards Drawings Pool</td><td className="text-right py-2 px-3">5%</td><td className="text-right py-2 px-3">50,000,000</td></tr>
                    <tr className="border-t border-white/10"><td className="py-2 px-3">Team / Creators</td><td className="text-right py-2 px-3">15%</td><td className="text-right py-2 px-3">150,000,000</td></tr>
                    <tr className="border-t border-white/10"><td className="py-2 px-3">Treasury / Ecosystem</td><td className="text-right py-2 px-3">5%</td><td className="text-right py-2 px-3">50,000,000</td></tr>
                    <tr className="border-t border-white/10"><td className="py-2 px-3">Burn Reserve</td><td className="text-right py-2 px-3">5%</td><td className="text-right py-2 px-3">50,000,000</td></tr>
                    <tr className="border-t border-white/20 bg-black/40 font-bold"><td className="py-2 px-3">Total</td><td className="text-right py-2 px-3">100%</td><td className="text-right py-2 px-3">1,000,000,000</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">8.2 Vesting & Locks</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Private Presale:</strong> 20% TGE, 6-month linear</li>
                <li><strong>Team / Creators:</strong> 25% at month 3, 25% at month 12, 25% at month 14, 25% at month 15.</li>
                <li><strong>Treasury:</strong> staged unlock</li>
                <li><strong>Liquidity:</strong> locked 6–12 months</li>
                <li><strong>Burn Reserve:</strong> 1% per year for 5 years</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">8.4 Token Utility Summary</h3>
              <p>XESS is used for: rewards, qualification for credits, alignment, future governance.</p>
              <p className="font-semibold text-white/90">XESS is not required for access, payment, or consumption.</p>
            </div>
          </section>

          {/* Section 9: Governance */}
          <section id="governance" className="bg-gray-900/50 border border-indigo-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-indigo-300">9. Governance (Future)</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p className="font-semibold text-white/90">Governance is intentionally deferred until the platform matures.</p>

              <h3 className="text-lg font-semibold text-white mt-4 mb-2">9.1 Initial Phase (Centralized Operations)</h3>
              <p>Admin-managed parameters: Credit rates, Reward weighting, Unlock costs, Moderation policy.</p>
              <p>This allows fast iteration and safety.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">9.2 Transitional Phase (Hybrid)</h3>
              <p>Community feedback loops, Signal-based voting, Non-binding governance experiments, Public transparency.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">9.3 Long-Term Vision (Decentralized)</h3>
              <p>Future governance may include: parameter voting, burn schedule adjustments, treasury use, partner onboarding, content policy guidance.</p>
              <p>Governance will only be enabled once: abuse is controlled, participation quality is proven, legal clarity is maintained.</p>
            </div>
          </section>

          {/* Section 10: Security */}
          <section id="security" className="bg-gray-900/50 border border-red-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-red-300">10. Security & Risk</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p>Xessex is designed with risk minimization as a first-class requirement.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/40 rounded-xl p-4 border border-green-400/20">
                  <div className="font-semibold text-green-400 mb-2">Custody Risk (Eliminated)</div>
                  <p className="text-sm">Xessex never holds user funds. Rewards are claimed directly from the blockchain.</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-green-400/20">
                  <div className="font-semibold text-green-400 mb-2">Payment Processor Risk (Eliminated)</div>
                  <p className="text-sm">No subscriptions, no access sales, no adult payments, no refunds, no chargebacks.</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-yellow-400/20">
                  <div className="font-semibold text-yellow-400 mb-2">Smart Contract Risk (Minimized)</div>
                  <p className="text-sm">On-chain logic is limited to settlement. No complex DeFi interactions.</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-yellow-400/20">
                  <div className="font-semibold text-yellow-400 mb-2">Abuse & Farming Risk (Mitigated)</div>
                  <p className="text-sm">Wallet-native identity, unlock-based gating, ledgered credit system, delayed rewards.</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">10.5 Market Risk (Explicitly Accepted)</h3>
              <p>Token price volatility is acknowledged. However: the platform functions without price dependence, access is not tied to token price, rewards continue regardless of market conditions.</p>
              <p className="font-semibold text-white/90">This decoupling is intentional and rare.</p>
            </div>
          </section>

          {/* Section 11: Roadmap */}
          <section id="roadmap" className="bg-gray-900/50 border border-teal-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-teal-300">11. Roadmap</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p>Xessex is designed for long-term operation, not short-term hype.</p>

              <div className="space-y-4">
                <div className="bg-black/40 rounded-xl p-4 border border-emerald-400/30">
                  <div className="font-semibold text-emerald-400 mb-2">Phase 0 — Complete (Foundation)</div>
                  <p className="text-sm">Wallet-native auth, Unlock system, Credits system, Reward engine, Token minted on mainnet</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-blue-400/30">
                  <div className="font-semibold text-blue-400 mb-2">Phase 1 — Presale & Mainnet Launch</div>
                  <p className="text-sm">Private presale (30 days pre-launch), Public sale, Liquidity pools locked, Rewards live, First Xessex-owned content</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-purple-400/30">
                  <div className="font-semibold text-purple-400 mb-2">Phase 2 — Growth</div>
                  <p className="text-sm">Weekly content expansion, Partner video onboarding, Credit tuning, UI/UX polish, Anti-abuse automation</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-pink-400/30">
                  <div className="font-semibold text-pink-400 mb-2">Phase 3 — Scale</div>
                  <p className="text-sm">Data exports & APIs, Enterprise tools, Governance experiments, Creator partnerships</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-yellow-400/30">
                  <div className="font-semibold text-yellow-400 mb-2">Phase 4 — Maturity</div>
                  <p className="text-sm">Treasury DAO activation, Long-term burn schedule, Ecosystem grants, White-label curation</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 12: Legal */}
          <section id="legal" className="bg-gray-900/50 border border-gray-500/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-300">12. Legal Positioning</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p>Xessex is designed to operate in restricted and high-risk content environments safely and sustainably.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/40 rounded-xl p-4 border border-green-400/20">
                  <div className="font-semibold text-green-400 mb-2">What Xessex Is</div>
                  <ul className="text-sm space-y-1">
                    <li>A curation platform</li>
                    <li>A ranking engine</li>
                    <li>A reward network</li>
                    <li>A data system</li>
                  </ul>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-red-400/20">
                  <div className="font-semibold text-red-400 mb-2">What Xessex Is Not</div>
                  <ul className="text-sm space-y-1">
                    <li>A subscription service</li>
                    <li>A payment processor</li>
                    <li>A marketplace for adult content</li>
                    <li>A gambling platform</li>
                    <li>A financial intermediary</li>
                  </ul>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">Token Classification</h3>
              <p>XESS: is a utility token, provides no ownership, provides no profit guarantee, is not required to use the platform, does not represent revenue share.</p>
            </div>
          </section>

          {/* Section 13: Conclusion */}
          <section id="conclusion" className="bg-gray-900/50 border border-white/30 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 text-white">13. Conclusion</h2>
            <div className="text-white/70 leading-relaxed space-y-4">
              <p>Xessex is building the curation layer for video content, starting where existing platforms fail the most.</p>
              <p>By removing payments, subscriptions, and custody, Xessex becomes:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>more durable</li>
                <li>more scalable</li>
                <li>more legally defensible</li>
                <li>more aligned with users</li>
                <li>more resilient to shutdowns</li>
              </ul>
              <p>The XESS token aligns participation without creating dependency. The platform works even without price appreciation. Value accrues through data, engagement, and network effects.</p>
              <p className="text-xl font-semibold text-white mt-6">Xessex is not a bet on speculation. It is a bet on human curation at internet scale.</p>
            </div>
          </section>

          {/* Footer */}
          <div className="text-center text-white/40 text-sm mt-12 pt-8 border-t border-white/10">
            <div className="flex justify-center gap-4">
              <Link href="/tokenomics" className="text-cyan-400 hover:text-cyan-300">Tokenomics</Link>
              <Link href="/faq" className="text-cyan-400 hover:text-cyan-300">FAQ</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
