"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoginModal from "@/components/LoginModal";

export default function LoginPageClient() {
  const [showModal, setShowModal] = useState(true);
  const router = useRouter();

  // Redirect to home if modal is closed without selecting
  const handleClose = () => {
    setShowModal(false);
    router.push("/");
  };

  return (
    <div className="px-6 pb-10 flex justify-center items-center min-h-[60vh]">
      <LoginModal isOpen={showModal} onClose={handleClose} />

      {/* Fallback content if modal somehow closes */}
      {!showModal && (
        <div className="text-center text-white/60">
          Redirecting...
        </div>
      )}
    </div>
  );
}
