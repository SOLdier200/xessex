import Link from "next/link";
import { db } from "@/lib/prisma";
import { verifyRecoveryEmailToken } from "@/lib/recoveryEmail";
import AutoRedirect from "./AutoRedirect";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function RecoveryEmailVerifyPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params?.token || "";
  const payload = token ? verifyRecoveryEmailToken(token) : null;

  let status: "success" | "already" | "error" = "error";
  let message = "Invalid or expired verification link.";

  if (payload) {
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { recoveryEmail: true, recoveryEmailVerifiedAt: true },
    });

    if (!user || user.recoveryEmail !== payload.email) {
      status = "error";
      message = "This verification link no longer matches your account.";
    } else if (user.recoveryEmailVerifiedAt) {
      status = "already";
      message = "Your recovery email is already verified.";
    } else {
      await db.user.update({
        where: { id: payload.userId },
        data: { recoveryEmailVerifiedAt: new Date() },
      });
      status = "success";
      message = "Recovery email verified successfully.";
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/50 p-6 text-center">
        <AutoRedirect to="/profile" enabled={status === "success" || status === "already"} />
        <h1 className="text-2xl font-semibold text-white mb-2">Recovery Email</h1>
        <p
          className={`text-sm ${
            status === "success"
              ? "text-emerald-400"
              : status === "already"
              ? "text-yellow-300"
              : "text-red-400"
          }`}
        >
          {message}
        </p>
        {(status === "success" || status === "already") && (
          <p className="text-xs text-white/50 mt-2">Redirecting to your profile…</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/profile"
            className="px-4 py-2 rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-300 hover:bg-pink-500/30 transition"
          >
            Go to Profile
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 transition"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
