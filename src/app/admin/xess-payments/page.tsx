import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import XessPaymentsClient from "./ui";

export const dynamic = "force-dynamic";

export default async function XessPaymentsPage() {
  const access = await getAccessContext();
  if (!access.user) redirect("/login");
  if (!access.isAdminOrMod) redirect("/");

  return <XessPaymentsClient />;
}
