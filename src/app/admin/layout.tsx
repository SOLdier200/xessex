import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await getAccessContext();

  if (!access.user) {
    redirect("/login");
  }

  const adminWallets = new Set(
    (process.env.ADMIN_WALLETS || "")
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean)
  );

  const isAdminByRole = access.user.role === "ADMIN";
  const isAdminByWallet = !!(access.user.walletAddress && adminWallets.has(access.user.walletAddress));

  if (!isAdminByRole && !isAdminByWallet) {
    redirect("/mod");
  }

  return <>{children}</>;
}
