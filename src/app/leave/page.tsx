export default function LeavePage() {
  return (
    <main className="min-h-screen bg-[#050a1a] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-2xl border-2 border-pink-500 rounded-2xl p-8 bg-black/30">
        <h1 className="text-2xl font-semibold border-2 border-pink-500 rounded-xl px-4 py-2 inline-block">
          You&apos;ve chosen to leave
        </h1>

        <p className="mt-4 border-2 border-pink-500 rounded-xl px-4 py-3 text-white/90 leading-6">
          If you&apos;re under 18 or adult content isn&apos;t appropriate for you, you&apos;re in the right place.
          This site is intended for adults only.
        </p>

        <div className="mt-4 grid gap-3">
          <a
            className="border-2 border-pink-500 rounded-xl px-4 py-3 hover:bg-white/5"
            href="https://www.google.com/safe-search"
            rel="noreferrer"
            target="_blank"
          >
            Turn on SafeSearch (Google)
          </a>

          <a
            className="border-2 border-pink-500 rounded-xl px-4 py-3 hover:bg-white/5"
            href="https://support.microsoft.com/en-us/account-billing/set-up-family-safety-8eac8a25-1e0c-4b4f-bd41-7d2baf7b0c70"
            rel="noreferrer"
            target="_blank"
          >
            Set up Microsoft Family Safety
          </a>

          <a
            className="border-2 border-pink-500 rounded-xl px-4 py-3 hover:bg-white/5"
            href="https://support.apple.com/en-us/HT201304"
            rel="noreferrer"
            target="_blank"
          >
            Set up Apple Screen Time
          </a>
        </div>

        <p className="mt-5 text-sm text-white/70 border-2 border-pink-500 rounded-xl px-4 py-3">
          Tip: Most routers and parental control tools can block categories of adult websites automatically.
        </p>

        <div className="mt-6 flex gap-3">
          <a
            className="flex-1 text-center border-2 border-pink-500 rounded-xl px-4 py-3 hover:bg-white/5"
            href="/age"
          >
            Go back
          </a>

          <a
            className="flex-1 text-center bg-white text-black rounded-xl px-4 py-3 hover:opacity-90"
            href="https://www.google.com"
          >
            Continue to a safe site
          </a>
        </div>
      </div>
    </main>
  );
}
