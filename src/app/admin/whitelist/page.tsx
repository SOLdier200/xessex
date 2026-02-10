import { getAccessContext } from "@/lib/access";
import { redirect } from "next/navigation";
import WhitelistAdminClient from "./WhitelistAdminClient";

export const dynamic = "force-dynamic";

export default async function WhitelistAdminPage() {
  const ctx = await getAccessContext();

  if (!ctx.isAdminOrMod) {
    redirect("/");
  }

  return <WhitelistAdminClient isAdmin={ctx.user?.role === "ADMIN"} />;
}
