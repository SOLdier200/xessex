import Link from "next/link";
import Image from "next/image";

export default function ContactPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="inline-block mb-8">
        <Image
          src="/logos/neonmainlogo1.png"
          alt="Xessex"
          width={200}
          height={60}
          className="h-12 w-auto hover:opacity-80 transition"
        />
      </Link>

      <h1 className="text-3xl font-bold text-white mb-2">Contact Us</h1>
      <p className="text-sm text-white/50 mb-8">We respond as quickly as possible.</p>

      {/* About Us Section */}
      <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-6 mb-8">
        <h2 className="text-xl font-semibold text-purple-300 mb-4">About Us</h2>
        <div className="text-white/80 space-y-4">
          <p>
            I'm Jordan, the admin and creator of this site. We are not a business — I'm just one guy.
            There is no office building, it's just me at home. Therefore, I don't have an address listed,
            but it's only because I don't want any crazies coming to my home, otherwise I would.
            So this is the reason you don't see any address listed.
          </p>
          <p>
            I do hope to be as transparent as possible and plan on earning users' trust through time.
            I run this project like I run my own life — honest, with integrity, honor, and a strong
            commitment to a high moral standard.
          </p>
          <p>
            I look forward to building community trust, partnerships with other projects, and a reputation
            that opens doors for the project.
          </p>
          <p>
            That said, if you have any problems, issues, comments, concerns, questions, or recommendations
            you can reach me at{" "}
            <a href="mailto:admin@xessex.me" className="text-sky-400 hover:text-sky-300 transition font-medium">
              admin@xessex.me
            </a>
          </p>
        </div>
      </div>

      {/* Contact Info */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-white/80">
        <div className="text-lg font-semibold text-white">Contact Information</div>

        <div className="mt-4 space-y-2">
          <div>
            <span className="text-white/60">Location:</span>{" "}
            <span>Sacramento, CA 95834</span>
          </div>
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
