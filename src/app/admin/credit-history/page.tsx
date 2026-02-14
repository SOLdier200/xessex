import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import CreditHistoryClient from "./ui";

export default async function CreditHistoryPage() {
  const access = await getAccessContext();
  if (!access.user) redirect("/login");
  if (!access.isAdminOrMod) redirect("/");

  return <CreditHistoryClient />;
}
