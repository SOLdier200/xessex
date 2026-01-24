"use client";

import TopNav from "../../components/TopNav";
import Image from "next/image";
import AccountWalletStatus from "@/components/AccountWalletStatus";
import EmailLoginBox from "@/components/EmailLoginBox";
import GoogleSignupButton from "../../components/GoogleSignupButton";
import Link from "next/link";

export default function MemberLoginPage() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="px-6 pb-10 flex justify-center">
        <div className="w-full max-w-xl space-y-6">
          <AccountWalletStatus />

          {/* Member Login - Email & Google */}
          <div className="neon-border rounded-2xl p-6 bg-black/30">
            <Image
              src="/logos/textlogo/siteset3/login100.png"
              alt="Member Login"
              width={938}
              height={276}
              className="h-[44px] w-auto"
            />
            <p className="mt-2 text-sm text-white/70">
              Sign in with your email or Google account.
            </p>

            <div className="mt-6">
              <GoogleSignupButton />
            </div>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 border-t border-white/20"></div>
              <span className="text-white/40 text-sm">or use email</span>
              <div className="flex-1 border-t border-white/20"></div>
            </div>

            <EmailLoginBox />

            <div className="mt-4 text-center">
              <a
                href="/signup"
                className="text-pink-400 hover:text-pink-300 text-sm underline"
              >
                Sign up with Email
              </a>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/login/diamond"
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Sign in as Diamond instead
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
