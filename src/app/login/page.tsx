import TopNav from "../components/TopNav";
import SolanaProviders from "@/components/SolanaProviders";
import WalletLoginButton from "@/components/WalletLoginButton";
import EmailLoginBox from "@/components/EmailLoginBox";
import GoogleSignupButton from "../components/GoogleSignupButton";

export default function LoginPage() {
  return (
    <main className="min-h-screen">
      <TopNav />

      <SolanaProviders>
        <div className="px-6 pb-10 flex justify-center">
          <div className="w-full max-w-xl space-y-6">

            {/* Email Login (Paid Members) */}
            <div className="neon-border rounded-2xl p-6 bg-black/30">
              <h1 className="text-2xl font-semibold neon-text">Member Login (Email)</h1>
              <p className="mt-2 text-sm text-white/70">
                If you purchased a membership using an email account, sign in here.
              </p>
              <div className="mt-6">
                <EmailLoginBox />
              </div>
            </div>

            {/* Google Login */}
            <div className="neon-border rounded-2xl p-6 bg-black/30">
              <h2 className="text-xl font-semibold neon-text">Sign in with Google</h2>
              <p className="mt-2 text-sm text-white/70">
                Quick sign in using your Google account.
              </p>
              <div className="mt-6">
                <GoogleSignupButton />
              </div>
              <div className="mt-3 text-center text-xs text-white/50">
                Note: Didn&apos;t sign in? Try again
              </div>
            </div>

            <div className="text-center text-white/40 text-sm">or</div>

            {/* Wallet Login */}
            <div className="neon-border rounded-2xl p-6 bg-black/30">
              <h2 className="text-xl font-semibold neon-text">Wallet Login</h2>
              <p className="mt-2 text-sm text-white/70">
                Login with Solana Wallet to interact with Xess token Features!
              </p>
              <div className="mt-6">
                <WalletLoginButton />
              </div>
            </div>

          </div>
        </div>
      </SolanaProviders>
    </main>
  );
}
