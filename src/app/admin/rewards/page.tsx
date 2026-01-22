import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import AdminRewardsClient from "./ui";

export default async function AdminRewardsPage() {
  const access = await getAccessContext();
  if (!access.user) redirect("/login");
  if (!access.isAdminOrMod) redirect("/");

  return <AdminRewardsClient />;
}
