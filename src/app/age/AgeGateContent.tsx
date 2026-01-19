type AgeGateContentProps = {
  next?: string;
};

export default function AgeGateContent({ next = "/" }: AgeGateContentProps) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-6 md:py-10 relative overflow-hidden">
      {/* Background logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src="/logos/xessexcoinlogo2.png"
          alt=""
          className="w-[80vmin] h-[80vmin] object-contain opacity-20"
          loading="eager"
          decoding="async"
        />
      </div>
      <div className="w-full max-w-2xl relative z-10">
        <div className="rounded-2xl p-4 md:p-8 bg-black/60 backdrop-blur-sm">
          <div className="flex justify-center mb-4">
            <img
              src="/logos/neonmainlogo1.png"
              alt="Xessex"
              className="w-[101px] md:w-[137px] h-auto"
              loading="eager"
              decoding="async"
            />
          </div>

          <h1 className="text-xl md:text-3xl font-semibold text-center">
            THIS IS AN <span className="text-pink-400 animate-pulse">ADULT WEBSITE</span>
          </h1>

          <p className="mt-4 text-center text-white/90">
            This website contains age-restricted materials including nudity and explicit depictions of sexual activity.
          </p>

          <p className="mt-4 text-center text-white/90">
            By entering, you agree to our{" "}
            <a href="/terms" className="text-pink-400 underline">
              Terms of Service
            </a>.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <form action="/age/accept" method="GET" className="flex-1">
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                className="w-full rounded-xl border-2 border-pink-500 bg-pink-500/20 text-white font-semibold py-4 min-h-[56px] touch-manipulation cursor-pointer"
              >
                I am 18 or older - Enter
              </button>
            </form>

            <a
              href="https://www.google.com"
              className="flex-1 inline-flex items-center justify-center rounded-xl border-2 border-pink-500 bg-pink-500 font-semibold py-4 min-h-[56px] touch-manipulation cursor-pointer"
              style={{ color: "black" }}
            >
              I am under 18 - Exit
            </a>
          </div>

          <p className="mt-6 text-center text-white/90">
            Our{" "}
            <a href="/parental-controls" className="text-pink-400 underline">
              parental controls page
            </a>{" "}
            explains how to block access.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3 text-white/50 text-sm">
            <span>© Xessex.me {new Date().getFullYear()}</span>
            <img
              src="/logos/rta.gif"
              alt="RTA - Restricted to Adults"
              width={88}
              height={31}
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
