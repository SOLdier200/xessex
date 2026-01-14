import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import SourceGradesAuditTable from "@/app/components/mod/SourceGradesAuditTable";

export default async function SourceGradesAuditPage() {
  const access = await getAccessContext();

  if (!access.user || !access.isAdminOrMod) {
    redirect("/");
  }

  return (
    <main className="min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold neon-text">Source Grades Audit</h1>
          <p className="text-white/60 text-sm mt-1">
            Review all source grade actions by mods and admins
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="px-4 py-2 rounded-full border border-pink-400/50 bg-pink-500/20 text-white text-sm font-semibold hover:bg-pink-500/30 transition"
          >
            Back to Admin
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-full border border-white/30 bg-black/40 text-white text-sm font-semibold hover:border-white/50 transition"
          >
            Back to Site
          </Link>
        </div>
      </div>

      {/* Audit Table */}
      <SourceGradesAuditTable />
    </main>
  );
}
