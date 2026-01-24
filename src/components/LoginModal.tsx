"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="flex justify-center mb-2">
          <Image
            src="/logos/textlogo/siteset3/login100.png"
            alt="Login"
            width={982}
            height={247}
            className="h-[50px] w-auto"
          />
        </div>
        <p className="text-center text-white/60 mb-8">Choose your login method</p>

        <div className="space-y-4">
          {/* Diamond Login - Full blue border with moving highlight */}
          <div className="relative group">
            {/* Base blue border */}
            <div className="absolute -inset-[2px] rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500" />
            {/* Rotating bright highlight */}
            <div className="absolute -inset-[2px] rounded-xl overflow-hidden">
              <div
                className="absolute inset-0 animate-spin-slow"
                style={{
                  background: "conic-gradient(from 0deg, transparent 0deg, transparent 270deg, #ffffff 300deg, #67e8f9 330deg, transparent 360deg)",
                }}
              />
            </div>
            <button
              onClick={() => {
                onClose();
                router.push("/login/diamond");
              }}
              className="relative w-full py-4 px-6 rounded-xl bg-black hover:bg-gray-900 transition-all duration-200 flex items-center justify-center gap-3"
            >
              <Image
                src="/logos/textlogo/siteset3/diamond100.png"
                alt="Diamond Login"
                width={1536}
                height={282}
                className="h-[40px] w-auto"
              />
            </button>
          </div>

          {/* Member Login - Pink border with subtle pulse */}
          <div className="relative group">
            <div className="absolute -inset-[2px] rounded-xl bg-pink-500 animate-pulse-subtle" />
            <button
              onClick={() => {
                onClose();
                router.push("/login/member");
              }}
              className="relative w-full py-4 px-6 rounded-xl bg-black hover:bg-gray-900 transition-all duration-200 flex items-center justify-center gap-3"
            >
              <Image
                src="/logos/textlogo/siteset3/member100.png"
                alt="Member Login"
                width={974}
                height={286}
                className="h-[40px] w-auto"
              />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 2.5s linear infinite;
        }
        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 8px rgba(236, 72, 153, 0.4);
          }
          50% {
            opacity: 0.85;
            box-shadow: 0 0 16px rgba(236, 72, 153, 0.6);
          }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
