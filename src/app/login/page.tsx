import TopNav from "../components/TopNav";
import SolanaProviders from "@/components/SolanaProviders";
import AccountWalletStatus from "@/components/AccountWalletStatus";
import WalletActions from "@/components/WalletActions";
import EmailLoginBox from "@/components/EmailLoginBox";
import GoogleSignupButton from "../components/GoogleSignupButton";

export default function LoginPage() {
  return (
    <main className="min-h-screen">
      <TopNav />

      <SolanaProviders>
        <div className="px-6 pb-10 flex justify-center">
          <div className="w-full max-w-xl space-y-6">
            <AccountWalletStatus />

            {/* Member Login (Email + Google) */}
            <div className="neon-border rounded-2xl p-6 bg-black/30">
              <h1 className="text-2xl font-semibold neon-text">Member Login</h1>
              <p className="mt-2 text-sm text-white/70">
                Sign in with your email or Google account.
              </p>

              {/* Google Sign In */}
              <div className="mt-6">
                <GoogleSignupButton />
              </div>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 border-t border-white/20"></div>
                <span className="text-white/40 text-sm">or use email</span>
                <div className="flex-1 border-t border-white/20"></div>
              </div>

              {/* Email Login */}
              <EmailLoginBox />
            </div>

            <div className="text-center text-white/40 text-sm">or</div>

            {/* Wallet Login */}
            <div className="neon-border rounded-2xl p-6 bg-black/30">
              <h2 className="text-xl font-semibold neon-text">Wallet Login</h2>
              <p className="mt-2 text-sm text-white/70">
                Login with Solana Wallet to interact with Xess token Features!
              </p>
              <div className="mt-6">
                <WalletActions />
              </div>
            </div>

          </div>
        </div>
      </SolanaProviders>
    </main>
  );
}
