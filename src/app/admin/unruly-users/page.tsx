"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface CommentSpammer {
  id: string;
  email: string | null;
  wallet: string | null;
  status: string;
  removedCount: number;
  lastWarning: {
    type: string;
    createdAt: string;
    acknowledged: boolean;
  } | null;
  createdAt: string;
}

interface DislikeSpammer {
  id: string;
  email: string | null;
  wallet: string | null;
  status: string;
  totalVotes: number;
  dislikes: number;
  dislikeRatio: number;
  createdAt: string;
}

interface BannedUser {
  id: string;
  email: string | null;
  wallet: string | null;
  status: string;
  banUntil: string | null;
  banReason: string | null;
  removedCount: number;
  latestBan: {
    type: string;
    bannedAt: string;
    unbannedAt: string | null;
    rebannedAt: string | null;
  } | null;
  createdAt: string;
}

export default function AdminUnrulyUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [commentSpammers, setCommentSpammers] = useState<CommentSpammer[]>([]);
  const [dislikeSpammers, setDislikeSpammers] = useState<DislikeSpammer[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json();

        if (!data.ok || !data.authed || data.user?.role !== "ADMIN") {
          router.push("/");
          return;
        }
      } catch (err) {
        setError("Failed to verify access");
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [router]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [unrulyRes, bannedRes] = await Promise.all([
        fetch("/api/mod/unruly-users", { credentials: "include" }),
        fetch("/api/mod/banned-users", { credentials: "include" }),
      ]);

      const unrulyData = await unrulyRes.json();
      const bannedData = await bannedRes.json();

      if (unrulyData.ok) {
        setCommentSpammers(unrulyData.commentSpammers || []);
        setDislikeSpammers(unrulyData.dislikeSpammers || []);
      }

      if (bannedData.ok) {
        setBannedUsers(bannedData.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      fetchData();
    }
  }, [loading, error, fetchData]);

  const getUserDisplay = (u: { email: string | null; wallet: string | null; id: string }): string => {
    if (u.email) return u.email;
    if (u.wallet) return `${u.wallet.slice(0, 4)}...${u.wallet.slice(-4)}`;
    return u.id.slice(0, 8);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "TEMP_BANNED":
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">Temp Banned</span>;
      case "PERM_BANNED":
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Perm Banned</span>;
      case "UNBANNED":
        return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">Unbanned</span>;
      case "WARNED":
        return <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">Warned</span>;
      default:
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Allowed</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-pink-500 text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-red-500 text-xl">{error}</div>
        <Link href="/admin/controls" className="text-pink-500 hover:text-pink-400 underline">
          Back to Admin
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold neon-text">Unruly Users</h1>
          <p className="text-white/60 text-sm mt-1">Review spammers and banned users</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            disabled={dataLoading}
            className="px-4 py-2 rounded-full border border-pink-400/50 bg-pink-500/20 text-white text-sm font-semibold hover:bg-pink-500/30 transition disabled:opacity-50"
          >
            {dataLoading ? "Loading..." : "Refresh"}
          </button>
          <Link
            href="/admin/controls"
            className="px-4 py-2 rounded-full border border-white/30 bg-black/40 text-white text-sm font-semibold hover:bg-white/10 transition"
          >
            Back to Admin
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="neon-border rounded-xl p-4 bg-black/30">
          <div className="text-orange-500 text-3xl font-bold">{commentSpammers.length}</div>
          <div className="text-white/60 text-sm">Comment Spammers</div>
        </div>
        <div className="neon-border rounded-xl p-4 bg-black/30">
          <div className="text-purple-500 text-3xl font-bold">{dislikeSpammers.length}</div>
          <div className="text-white/60 text-sm">Dislike Spammers</div>
        </div>
        <div className="neon-border rounded-xl p-4 bg-black/30">
          <div className="text-red-500 text-3xl font-bold">
            {bannedUsers.filter((u) => u.status === "PERM_BANNED").length}
          </div>
          <div className="text-white/60 text-sm">Perm Banned</div>
        </div>
        <div className="neon-border rounded-xl p-4 bg-black/30">
          <div className="text-yellow-500 text-3xl font-bold">
            {bannedUsers.filter((u) => u.status === "TEMP_BANNED").length}
          </div>
          <div className="text-white/60 text-sm">Temp Banned</div>
        </div>
      </div>

      {/* Comment Spammers */}
      <div className="neon-border rounded-2xl bg-black/30 mb-8">
        <div className="p-4 border-b border-orange-500/30">
          <h2 className="text-xl font-bold text-orange-400">Comment Spammers</h2>
          <p className="text-white/60 text-sm">Users with 3+ removed comments</p>
        </div>
        <div className="p-4">
          {commentSpammers.length === 0 ? (
            <div className="text-center text-white/40 py-8">No comment spammers found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-white/60 text-sm">
                    <th className="pb-3">User</th>
                    <th className="pb-3">Removed</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Last Warning</th>
                    <th className="pb-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {commentSpammers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/5">
                      <td className="py-3">
                        <div className="text-white">{getUserDisplay(u)}</div>
                        <div className="text-white/40 text-xs">{u.id.slice(0, 12)}...</div>
                      </td>
                      <td className="py-3">
                        <span className={`font-bold ${u.removedCount >= 5 ? "text-red-400" : "text-orange-400"}`}>
                          {u.removedCount}
                        </span>
                      </td>
                      <td className="py-3">{getStatusBadge(u.status)}</td>
                      <td className="py-3 text-white/60 text-sm">
                        {u.lastWarning ? formatDate(u.lastWarning.createdAt) : "-"}
                      </td>
                      <td className="py-3 text-white/60 text-sm">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dislike Spammers */}
      <div className="neon-border rounded-2xl bg-black/30 mb-8">
        <div className="p-4 border-b border-purple-500/30">
          <h2 className="text-xl font-bold text-purple-400">Dislike Spammers</h2>
          <p className="text-white/60 text-sm">Users who dislike 75%+ of comments (min 10 votes)</p>
        </div>
        <div className="p-4">
          {dislikeSpammers.length === 0 ? (
            <div className="text-center text-white/40 py-8">No dislike spammers found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-white/60 text-sm">
                    <th className="pb-3">User</th>
                    <th className="pb-3">Dislike Ratio</th>
                    <th className="pb-3">Total Votes</th>
                    <th className="pb-3">Dislikes</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {dislikeSpammers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/5">
                      <td className="py-3">
                        <div className="text-white">{getUserDisplay(u)}</div>
                        <div className="text-white/40 text-xs">{u.id.slice(0, 12)}...</div>
                      </td>
                      <td className="py-3">
                        <span className={`font-bold ${u.dislikeRatio >= 90 ? "text-red-400" : "text-purple-400"}`}>
                          {u.dislikeRatio}%
                        </span>
                      </td>
                      <td className="py-3 text-white/60">{u.totalVotes}</td>
                      <td className="py-3 text-red-400">{u.dislikes}</td>
                      <td className="py-3">{getStatusBadge(u.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Banned Users */}
      <div className="neon-border rounded-2xl bg-black/30">
        <div className="p-4 border-b border-red-500/30">
          <h2 className="text-xl font-bold text-red-400">Banned Users</h2>
          <p className="text-white/60 text-sm">All users with comment restrictions</p>
        </div>
        <div className="p-4">
          {bannedUsers.length === 0 ? (
            <div className="text-center text-white/40 py-8">No banned users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-white/60 text-sm">
                    <th className="pb-3">User</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Removed</th>
                    <th className="pb-3">Ban Type</th>
                    <th className="pb-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {bannedUsers.map((u) => (
                    <tr
                      key={u.id}
                      className={`${u.status === "UNBANNED" ? "opacity-50" : ""} hover:bg-white/5`}
                    >
                      <td className="py-3">
                        <div className="text-white">{getUserDisplay(u)}</div>
                        <div className="text-white/40 text-xs">{u.id.slice(0, 12)}...</div>
                      </td>
                      <td className="py-3">{getStatusBadge(u.status)}</td>
                      <td className="py-3 text-red-400 font-bold">{u.removedCount}</td>
                      <td className="py-3 text-white/60 text-sm">
                        {u.latestBan?.type.replace(/_/g, " ") || "-"}
                      </td>
                      <td className="py-3 text-white/60 text-sm max-w-xs truncate">
                        {u.banReason || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
