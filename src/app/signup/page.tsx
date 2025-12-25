import TopNav from "../components/TopNav";

export default function SignupPage() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10 flex justify-center">
        <div className="w-full max-w-xl neon-border rounded-2xl p-6 bg-black/30">
          <h1 className="text-2xl font-semibold neon-text">Sign up</h1>
          <p className="mt-2 text-sm text-white/70">Coming next: email/pass + wallet optional.</p>
        </div>
      </div>
    </main>
  );
}
