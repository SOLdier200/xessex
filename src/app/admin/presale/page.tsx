import { getAccessContext } from "@/lib/access";
import { redirect } from "next/navigation";
import PresaleAdminClient from "./PresaleAdminClient";

export const dynamic = "force-dynamic";

export default async function PresaleAdminPage() {
  const ctx = await getAccessContext();

  if (!ctx.isAdminOrMod) {
    redirect("/");
  }

  return <PresaleAdminClient isAdmin={ctx.user?.role === "ADMIN"} />;
}
