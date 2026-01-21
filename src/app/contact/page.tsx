export default function ContactPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Contact Us</h1>
      <p className="text-sm text-white/50 mb-8">We respond as quickly as possible.</p>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-white/80">
        <div className="text-lg font-semibold text-white">Jordan Miller</div>
        <div className="mt-2">Sacramento, CA 95834</div>

        <div className="mt-6 space-y-2">
          <div>
            <span className="text-white/60">Admin:</span>{" "}
            <a href="mailto:admin@xessex.me" className="text-sky-400 hover:text-sky-300 transition">
              admin@xessex.me
            </a>
          </div>
          <div>
            <span className="text-white/60">Support:</span>{" "}
            <a href="mailto:support@xessex.me" className="text-sky-400 hover:text-sky-300 transition">
              support@xessex.me
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
