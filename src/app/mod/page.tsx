"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReportedCommentsPanel from "@/app/components/mod/ReportedCommentsPanel";

interface UserInfo {
  id: string;
  email: string | null;
  role: string;
}

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

interface StarAbuser {
  id: string;
  email: string | null;
  wallet: string | null;
  status: string;
  oneStarCount: number;
  lastWarning: {
    createdAt: string;
    acknowledged: boolean;
  } | null;
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

interface UserActivity {
  user: {
    id: string;
    email: string | null;
    wallet: string | null;
    role: string;
    commentBanStatus: string;
    commentBanUntil: string | null;
    commentBanReason: string | null;
    voteBanStatus: string;
    voteBanUntil: string | null;
    voteBanReason: string | null;
    ratingBanStatus: string;
    ratingBanUntil: string | null;
    ratingBanReason: string | null;
    createdAt: string;
  };
  summary: {
    comments: { total: number; active: number; removed: number };
    votes: { total: number; likes: number; dislikes: number; dislikeRatio: number };
    ratings: { total: number; average: number; breakdown: Record<number, number> };
  };
  comments: Array<{
    id: string;
    videoId: string;
    body: string;
    status: string;
    likes: number;
    dislikes: number;
    score: number;
    createdAt: string;
    removedAt: string | null;
    removedReason: string | null;
  }>;
  votes: Array<{
    id: string;
    commentId: string;
    value: number;
    createdAt: string;
    commentPreview: string;
    commentAuthor: string;
    videoId: string;
  }>;
  ratings: Array<{
    id: string;
    videoId: string;
    score: number;
    createdAt: string;
  }>;
}

export default function ModDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Unruly users state
  const [commentSpammers, setCommentSpammers] = useState<CommentSpammer[]>([]);
  const [dislikeSpammers, setDislikeSpammers] = useState<DislikeSpammer[]>([]);
  const [starAbusers, setStarAbusers] = useState<StarAbuser[]>([]);
  const [unrulyLoading, setUnrulyLoading] = useState(false);

  // Banned users state
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [bannedLoading, setBannedLoading] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    userId: string;
    action: "ban" | "unban";
    targetType: "comment" | "vote" | "rating";
    duration?: "1_week" | "2_week" | "4_week" | "permanent";
    userDisplay: string;
  } | null>(null);

  // User activity modal state
  const [activityModal, setActivityModal] = useState<{
    open: boolean;
    loading: boolean;
    userId: string;
    data: UserActivity | null;
  } | null>(null);

  // Active tab for activity modal
  const [activityTab, setActivityTab] = useState<"comments" | "votes" | "ratings">("comments");

  const fetchUnrulyUsers = useCallback(async () => {
    setUnrulyLoading(true);
    try {
      const res = await fetch("/api/mod/unruly-users", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setCommentSpammers(data.commentSpammers || []);
        setDislikeSpammers(data.dislikeSpammers || []);
        setStarAbusers(data.starAbusers || []);
      }
    } catch (err) {
      console.error("Failed to fetch unruly users:", err);
    } finally {
      setUnrulyLoading(false);
    }
  }, []);

  const fetchBannedUsers = useCallback(async () => {
    setBannedLoading(true);
    try {
      const res = await fetch("/api/mod/banned-users", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setBannedUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch banned users:", err);
    } finally {
      setBannedLoading(false);
    }
  }, []);

  const fetchUserActivity = useCallback(async (userId: string) => {
    setActivityModal({ open: true, loading: true, userId, data: null });
    setActivityTab("comments");
    try {
      const res = await fetch(`/api/mod/user-activity?userId=${userId}`, { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setActivityModal({ open: true, loading: false, userId, data });
      } else {
        setActivityModal(null);
        setActionError("Failed to load user activity");
      }
    } catch (err) {
      console.error("Failed to fetch user activity:", err);
      setActivityModal(null);
      setActionError("Failed to load user activity");
    }
  }, []);

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json();

        if (!data.ok || !data.authed || !data.user) {
          router.push("/login");
          return;
        }

        // Check if user is MOD or ADMIN
        if (data.user.role !== "MOD" && data.user.role !== "ADMIN") {
          setError("Access denied. Moderator privileges required.");
          return;
        }

        setUser(data.user);
      } catch (err) {
        setError("Failed to verify access");
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchUnrulyUsers();
      fetchBannedUsers();
    }
  }, [user, fetchUnrulyUsers, fetchBannedUsers]);

  const handleBanAction = async (
    userId: string,
    action: "ban" | "unban",
    targetType: "comment" | "vote" | "rating",
    duration?: "1_week" | "2_week" | "4_week" | "permanent"
  ) => {
    setActionLoading(userId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/mod/ban-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, action, targetType, duration }),
      });

      const data = await res.json();

      if (data.ok) {
        const durationLabel = duration === "1_week" ? "1 week" :
          duration === "2_week" ? "2 weeks" :
          duration === "4_week" ? "4 weeks" :
          duration === "permanent" ? "permanently" : "";
        setActionSuccess(
          action === "ban"
            ? `Successfully suspended ${targetType} for ${durationLabel}`
            : `Successfully restored ${targetType} ability`
        );
        // Refresh both lists
        await Promise.all([fetchUnrulyUsers(), fetchBannedUsers()]);
        // Refresh user activity if modal is open
        if (activityModal?.data) {
          fetchUserActivity(activityModal.userId);
        }
      } else {
        setActionError(data.error || "Action failed");
      }
    } catch (err) {
      setActionError("Failed to perform action");
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const openConfirmModal = (
    userId: string,
    action: "ban" | "unban",
    targetType: "comment" | "vote" | "rating",
    userDisplay: string,
    duration?: "1_week" | "2_week" | "4_week" | "permanent"
  ) => {
    setConfirmModal({ open: true, userId, action, targetType, duration, userDisplay });
  };

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
        <Link href="/" className="text-pink-500 hover:text-pink-400 underline">
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-pink-500/30 bg-black/90 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-pink-500">
              XESSEX
            </Link>
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
              Moderator Dashboard
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {user?.email || "Moderator"}
            </span>
            {user?.role === "ADMIN" && (
              <Link
                href="/admin/controls"
                className="px-4 py-2 bg-pink-500/20 text-pink-400 rounded-lg hover:bg-pink-500/30 transition"
              >
                Admin Console
              </Link>
            )}
            <Link
              href="/"
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition"
            >
              Exit
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Moderator Tools</h1>

        {/* Action Feedback */}
        {actionSuccess && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
            {actionError}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Comment Spammers</h3>
            <p className="text-3xl font-bold text-orange-500">{commentSpammers.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Dislike Spammers</h3>
            <p className="text-3xl font-bold text-purple-500">{dislikeSpammers.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Star Abusers</h3>
            <p className="text-3xl font-bold text-yellow-600">{starAbusers.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Temp Banned</h3>
            <p className="text-3xl font-bold text-yellow-500">
              {bannedUsers.filter((u) => u.status === "TEMP_BANNED").length}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Perm Banned</h3>
            <p className="text-3xl font-bold text-red-500">
              {bannedUsers.filter((u) => u.status === "PERM_BANNED").length}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Previously Unbanned</h3>
            <p className="text-3xl font-bold text-gray-500">
              {bannedUsers.filter((u) => u.status === "UNBANNED").length}
            </p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {user?.role === "ADMIN" && (
            <Link
              href="/admin/users"
              className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-6 hover:border-blue-500/50 transition group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold group-hover:text-blue-400 transition">User Management</h3>
              </div>
              <p className="text-gray-400">View user list, stats, and manage user roles.</p>
            </Link>
          )}

          {user?.role === "ADMIN" && (
            <Link
              href="/admin/controls"
              className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6 hover:border-green-500/50 transition group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold group-hover:text-green-400 transition">Admin Controls</h3>
              </div>
              <p className="text-gray-400">Access site settings and administrative functions.</p>
            </Link>
          )}
        </div>

        <ReportedCommentsPanel />

        {/* Comment Spammers Section */}
        <div className="bg-gray-900 border border-orange-500/30 rounded-xl mb-8">
          <div className="p-6 border-b border-orange-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-orange-400">Comment Spammers</h2>
                  <p className="text-sm text-gray-400">Users with 3+ removed comments (not yet banned)</p>
                </div>
              </div>
              <button
                onClick={fetchUnrulyUsers}
                disabled={unrulyLoading}
                className="px-3 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition text-sm"
              >
                {unrulyLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="p-6">
            {unrulyLoading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : commentSpammers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No comment spammers found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Removed Comments</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Last Warning</th>
                      <th className="pb-3 font-medium">Joined</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {commentSpammers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-800/50">
                        <td className="py-3">
                          <button
                            onClick={() => fetchUserActivity(u.id)}
                            className="text-left hover:text-pink-400 transition"
                          >
                            <div className="font-medium text-white hover:text-pink-400">{getUserDisplay(u)}</div>
                            <div className="text-xs text-gray-500 hover:text-pink-300">{u.id.slice(0, 12)}...</div>
                          </button>
                        </td>
                        <td className="py-3">
                          <span className={`font-bold ${u.removedCount >= 5 ? "text-red-400" : "text-orange-400"}`}>
                            {u.removedCount}
                          </span>
                        </td>
                        <td className="py-3">{getStatusBadge(u.status)}</td>
                        <td className="py-3">
                          {u.lastWarning ? (
                            <div className="text-sm">
                              <div className="text-gray-300">{u.lastWarning.type.replace(/_/g, " ")}</div>
                              <div className="text-gray-500 text-xs">{formatDate(u.lastWarning.createdAt)}</div>
                            </div>
                          ) : (
                            <span className="text-gray-500">None</span>
                          )}
                        </td>
                        <td className="py-3 text-gray-400 text-sm">{formatDate(u.createdAt)}</td>
                        <td className="py-3">
                          <button
                            onClick={() => fetchUserActivity(u.id)}
                            className="px-3 py-1 bg-pink-500/20 text-pink-400 rounded hover:bg-pink-500/30 transition text-sm"
                          >
                            View Activity
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Dislike Spammers Section */}
        <div className="bg-gray-900 border border-purple-500/30 rounded-xl mb-8">
          <div className="p-6 border-b border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-purple-400">Dislike Spammers</h2>
                  <p className="text-sm text-gray-400">Users who dislike 75%+ of comments they vote on (min 10 votes)</p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            {unrulyLoading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : dislikeSpammers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No dislike spammers found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Dislike Ratio</th>
                      <th className="pb-3 font-medium">Total Votes</th>
                      <th className="pb-3 font-medium">Dislikes</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {dislikeSpammers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-800/50">
                        <td className="py-3">
                          <button
                            onClick={() => fetchUserActivity(u.id)}
                            className="text-left hover:text-pink-400 transition"
                          >
                            <div className="font-medium text-white hover:text-pink-400">{getUserDisplay(u)}</div>
                            <div className="text-xs text-gray-500 hover:text-pink-300">{u.id.slice(0, 12)}...</div>
                          </button>
                        </td>
                        <td className="py-3">
                          <span className={`font-bold ${u.dislikeRatio >= 90 ? "text-red-400" : "text-purple-400"}`}>
                            {u.dislikeRatio}%
                          </span>
                        </td>
                        <td className="py-3 text-gray-300">{u.totalVotes}</td>
                        <td className="py-3 text-red-400">{u.dislikes}</td>
                        <td className="py-3">{getStatusBadge(u.status)}</td>
                        <td className="py-3">
                          <button
                            onClick={() => fetchUserActivity(u.id)}
                            className="px-3 py-1 bg-pink-500/20 text-pink-400 rounded hover:bg-pink-500/30 transition text-sm"
                          >
                            View Activity
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Star Abusers Section */}
        <div className="bg-gray-900 border border-yellow-600/30 rounded-xl mb-8">
          <div className="p-6 border-b border-yellow-600/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-yellow-500">Star Abusers</h2>
                  <p className="text-sm text-gray-400">Users who gave 10+ videos a 1-star rating</p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            {unrulyLoading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : starAbusers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No star abusers found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">1-Star Ratings</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Warning</th>
                      <th className="pb-3 font-medium">Joined</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {starAbusers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-800/50">
                        <td className="py-3">
                          <button
                            onClick={() => fetchUserActivity(u.id)}
                            className="text-left hover:text-pink-400 transition"
                          >
                            <div className="font-medium text-white hover:text-pink-400">{getUserDisplay(u)}</div>
                            <div className="text-xs text-gray-500 hover:text-pink-300">{u.id.slice(0, 12)}...</div>
                          </button>
                        </td>
                        <td className="py-3">
                          <span className={`font-bold ${u.oneStarCount >= 20 ? "text-red-400" : "text-yellow-500"}`}>
                            {u.oneStarCount}
                          </span>
                        </td>
                        <td className="py-3">{getStatusBadge(u.status)}</td>
                        <td className="py-3">
                          {u.lastWarning ? (
                            <div className="text-sm">
                              <div className={u.lastWarning.acknowledged ? "text-green-400" : "text-yellow-400"}>
                                {u.lastWarning.acknowledged ? "Acknowledged" : "Pending"}
                              </div>
                              <div className="text-gray-500 text-xs">{formatDate(u.lastWarning.createdAt)}</div>
                            </div>
                          ) : (
                            <span className="text-gray-500">No warning</span>
                          )}
                        </td>
                        <td className="py-3 text-gray-400 text-sm">{formatDate(u.createdAt)}</td>
                        <td className="py-3">
                          <button
                            onClick={() => fetchUserActivity(u.id)}
                            className="px-3 py-1 bg-pink-500/20 text-pink-400 rounded hover:bg-pink-500/30 transition text-sm"
                          >
                            View Activity
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Comment Banned Section */}
        <div className="bg-gray-900 border border-red-500/30 rounded-xl">
          <div className="p-6 border-b border-red-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-red-400">Comment Banned</h2>
                  <p className="text-sm text-gray-400">Users with comment restrictions (temp, perm, or unbanned)</p>
                </div>
              </div>
              <button
                onClick={fetchBannedUsers}
                disabled={bannedLoading}
                className="px-3 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition text-sm"
              >
                {bannedLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="p-6">
            {bannedLoading ? (
              <div className="text-center text-gray-400 py-8">Loading banned users...</div>
            ) : bannedUsers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No banned users found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Removed Comments</th>
                      <th className="pb-3 font-medium">Ban Info</th>
                      <th className="pb-3 font-medium">Reason</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {bannedUsers.map((u) => {
                      const isUnbanned = u.status === "UNBANNED";
                      return (
                        <tr
                          key={u.id}
                          className={`${isUnbanned ? "opacity-50 bg-gray-800/30" : "hover:bg-gray-800/50"}`}
                        >
                          <td className="py-3">
                            <button
                              onClick={() => fetchUserActivity(u.id)}
                              className="text-left hover:text-pink-400 transition"
                            >
                              <div className={`font-medium ${isUnbanned ? "text-gray-400" : "text-white"} hover:text-pink-400`}>
                                {getUserDisplay(u)}
                              </div>
                              <div className="text-xs text-gray-500 hover:text-pink-300">{u.id.slice(0, 12)}...</div>
                            </button>
                          </td>
                          <td className="py-3">{getStatusBadge(u.status)}</td>
                          <td className="py-3">
                            <span className="font-bold text-red-400">{u.removedCount}</span>
                          </td>
                          <td className="py-3">
                            {u.latestBan ? (
                              <div className="text-sm">
                                <div className="text-gray-300">{u.latestBan.type.replace(/_/g, " ")}</div>
                                <div className="text-gray-500 text-xs">
                                  Banned: {formatDate(u.latestBan.bannedAt)}
                                </div>
                                {u.banUntil && (
                                  <div className="text-yellow-400 text-xs">
                                    Until: {formatDate(u.banUntil)}
                                  </div>
                                )}
                                {u.latestBan.unbannedAt && (
                                  <div className="text-green-400 text-xs">
                                    Unbanned: {formatDate(u.latestBan.unbannedAt)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="text-sm text-gray-400 max-w-xs truncate" title={u.banReason || ""}>
                              {u.banReason || "-"}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => fetchUserActivity(u.id)}
                                className="px-3 py-1 bg-pink-500/20 text-pink-400 rounded hover:bg-pink-500/30 transition text-sm"
                              >
                                View
                              </button>
                              {isUnbanned ? (
                                <button
                                  onClick={() => openConfirmModal(u.id, "ban", "comment", getUserDisplay(u), "permanent")}
                                  disabled={actionLoading === u.id}
                                  className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition text-sm disabled:opacity-50"
                                >
                                  {actionLoading === u.id ? "..." : "Reban"}
                                </button>
                              ) : (
                                <button
                                  onClick={() => openConfirmModal(u.id, "unban", "comment", getUserDisplay(u))}
                                  disabled={actionLoading === u.id}
                                  className="px-3 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition text-sm disabled:opacity-50"
                                >
                                  {actionLoading === u.id ? "..." : "Unban"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {confirmModal?.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">
              {confirmModal.action === "unban"
                ? `Restore ${confirmModal.targetType} ability`
                : `Suspend ${confirmModal.targetType} ability`}
            </h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to{" "}
              <span className={confirmModal.action === "unban" ? "text-green-400" : "text-red-400"}>
                {confirmModal.action === "unban" ? "restore" : "suspend"}
              </span>{" "}
              <span className="font-medium text-white">{confirmModal.targetType}</span> ability for{" "}
              <span className="font-medium text-white">{confirmModal.userDisplay}</span>?
            </p>
            {confirmModal.action === "ban" && confirmModal.duration && (
              <p className="text-sm text-gray-400 mb-4">
                Duration:{" "}
                <span className="text-white">
                  {confirmModal.duration === "1_week" ? "1 week" :
                   confirmModal.duration === "2_week" ? "2 weeks" :
                   confirmModal.duration === "4_week" ? "4 weeks" : "Permanent"}
                </span>
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleBanAction(
                    confirmModal.userId,
                    confirmModal.action,
                    confirmModal.targetType,
                    confirmModal.duration
                  )
                }
                disabled={actionLoading === confirmModal.userId}
                className={`px-4 py-2 rounded-lg transition disabled:opacity-50 ${
                  confirmModal.action === "unban"
                    ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                    : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                }`}
              >
                {actionLoading === confirmModal.userId ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Activity Modal */}
      {activityModal?.open && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">User Activity Review</h3>
                {activityModal.data && (
                  <p className="text-gray-400 text-sm mt-1">
                    {activityModal.data.user.email || activityModal.data.user.wallet || activityModal.data.user.id}
                  </p>
                )}
              </div>
              <button
                onClick={() => setActivityModal(null)}
                className="text-gray-400 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {activityModal.loading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-pink-500">Loading user activity...</div>
              </div>
            ) : activityModal.data ? (
              <>
                {/* Summary Stats */}
                <div className="p-6 border-b border-gray-700">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-gray-400 text-sm mb-2">Comments</h4>
                      <div className="flex gap-4">
                        <div>
                          <span className="text-2xl font-bold text-white">{activityModal.data.summary.comments.total}</span>
                          <span className="text-gray-500 text-sm ml-1">total</span>
                        </div>
                        <div>
                          <span className="text-green-400 font-medium">{activityModal.data.summary.comments.active}</span>
                          <span className="text-gray-500 text-sm ml-1">active</span>
                        </div>
                        <div>
                          <span className="text-red-400 font-medium">{activityModal.data.summary.comments.removed}</span>
                          <span className="text-gray-500 text-sm ml-1">removed</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-gray-400 text-sm mb-2">Votes</h4>
                      <div className="flex gap-4">
                        <div>
                          <span className="text-2xl font-bold text-white">{activityModal.data.summary.votes.total}</span>
                          <span className="text-gray-500 text-sm ml-1">total</span>
                        </div>
                        <div>
                          <span className="text-green-400 font-medium">{activityModal.data.summary.votes.likes}</span>
                          <span className="text-gray-500 text-sm ml-1">likes</span>
                        </div>
                        <div>
                          <span className="text-red-400 font-medium">{activityModal.data.summary.votes.dislikes}</span>
                          <span className="text-gray-500 text-sm ml-1">dislikes</span>
                          <span className="text-purple-400 text-xs ml-1">({activityModal.data.summary.votes.dislikeRatio}%)</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-gray-400 text-sm mb-2">Ratings</h4>
                      <div className="flex gap-4">
                        <div>
                          <span className="text-2xl font-bold text-white">{activityModal.data.summary.ratings.total}</span>
                          <span className="text-gray-500 text-sm ml-1">total</span>
                        </div>
                        <div>
                          <span className="text-yellow-400 font-medium">{activityModal.data.summary.ratings.average}</span>
                          <span className="text-gray-500 text-sm ml-1">avg</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 text-xs">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className="text-gray-500">
                            {star}★: {activityModal.data!.summary.ratings.breakdown[star]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Moderation Actions */}
                <div className="p-6 border-b border-gray-700">
                  <h4 className="text-gray-400 text-sm mb-4 uppercase tracking-wide">Moderation Actions</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {/* Comment Status */}
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-white font-medium">Comments</h5>
                        {getStatusBadge(activityModal.data.user.commentBanStatus)}
                      </div>
                      {activityModal.data.user.commentBanUntil && (
                        <p className="text-yellow-400 text-xs mb-2">
                          Until: {formatDate(activityModal.data.user.commentBanUntil)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {activityModal.data.user.commentBanStatus !== "ALLOWED" &&
                         activityModal.data.user.commentBanStatus !== "WARNED" ? (
                          <button
                            onClick={() => openConfirmModal(activityModal.userId, "unban", "comment", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId)}
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "comment", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "1_week")}
                              className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs hover:bg-yellow-500/30"
                            >
                              1W
                            </button>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "comment", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "2_week")}
                              className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30"
                            >
                              2W
                            </button>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "comment", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "4_week")}
                              className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                            >
                              4W
                            </button>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "comment", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "permanent")}
                              className="px-2 py-1 bg-red-700/30 text-red-300 rounded text-xs hover:bg-red-700/40"
                            >
                              Perm
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Vote Status */}
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-white font-medium">Votes</h5>
                        {getStatusBadge(activityModal.data.user.voteBanStatus)}
                      </div>
                      {activityModal.data.user.voteBanUntil && (
                        <p className="text-yellow-400 text-xs mb-2">
                          Until: {formatDate(activityModal.data.user.voteBanUntil)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {activityModal.data.user.voteBanStatus !== "ALLOWED" &&
                         activityModal.data.user.voteBanStatus !== "WARNED" ? (
                          <button
                            onClick={() => openConfirmModal(activityModal.userId, "unban", "vote", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId)}
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "vote", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "1_week")}
                              className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs hover:bg-yellow-500/30"
                            >
                              1W
                            </button>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "vote", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "2_week")}
                              className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30"
                            >
                              2W
                            </button>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "vote", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "4_week")}
                              className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                            >
                              4W
                            </button>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "vote", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "permanent")}
                              className="px-2 py-1 bg-red-700/30 text-red-300 rounded text-xs hover:bg-red-700/40"
                            >
                              Perm
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Rating Status */}
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-white font-medium">Ratings</h5>
                        {getStatusBadge(activityModal.data.user.ratingBanStatus)}
                      </div>
                      {activityModal.data.user.ratingBanUntil && (
                        <p className="text-yellow-400 text-xs mb-2">
                          Until: {formatDate(activityModal.data.user.ratingBanUntil)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {activityModal.data.user.ratingBanStatus !== "ALLOWED" &&
                         activityModal.data.user.ratingBanStatus !== "WARNED" ? (
                          <button
                            onClick={() => openConfirmModal(activityModal.userId, "unban", "rating", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId)}
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "rating", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "1_week")}
                              className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs hover:bg-yellow-500/30"
                            >
                              1W
                            </button>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "rating", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "2_week")}
                              className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30"
                            >
                              2W
                            </button>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "rating", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "4_week")}
                              className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                            >
                              4W
                            </button>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "rating", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "permanent")}
                              className="px-2 py-1 bg-red-700/30 text-red-300 rounded text-xs hover:bg-red-700/40"
                            >
                              Perm
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-700 px-6">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setActivityTab("comments")}
                      className={`py-3 px-4 font-medium transition ${
                        activityTab === "comments"
                          ? "text-pink-400 border-b-2 border-pink-400"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Comments ({activityModal.data.comments.length})
                    </button>
                    <button
                      onClick={() => setActivityTab("votes")}
                      className={`py-3 px-4 font-medium transition ${
                        activityTab === "votes"
                          ? "text-pink-400 border-b-2 border-pink-400"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Votes ({activityModal.data.votes.length})
                    </button>
                    <button
                      onClick={() => setActivityTab("ratings")}
                      className={`py-3 px-4 font-medium transition ${
                        activityTab === "ratings"
                          ? "text-pink-400 border-b-2 border-pink-400"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Ratings ({activityModal.data.ratings.length})
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {activityTab === "comments" && (
                    <div className="space-y-3">
                      {activityModal.data.comments.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">No comments</div>
                      ) : (
                        activityModal.data.comments.map((c) => (
                          <div
                            key={c.id}
                            className={`p-4 rounded-lg ${
                              c.status === "REMOVED"
                                ? "bg-red-500/10 border border-red-500/30"
                                : "bg-gray-800"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-xs">{c.videoId.slice(0, 8)}...</span>
                                {c.status === "REMOVED" && (
                                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                                    REMOVED
                                  </span>
                                )}
                              </div>
                              <span className="text-gray-500 text-xs">{formatDate(c.createdAt)}</span>
                            </div>
                            <p className="text-white mb-2">{c.body}</p>
                            <div className="flex gap-4 text-xs text-gray-400">
                              <span className="text-green-400">{c.likes} likes</span>
                              <span className="text-red-400">{c.dislikes} dislikes</span>
                              <span>Score: {c.score}</span>
                            </div>
                            {c.removedReason && (
                              <div className="mt-2 text-sm text-red-400">
                                Reason: {c.removedReason}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activityTab === "votes" && (
                    <div className="space-y-2">
                      {activityModal.data.votes.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">No votes</div>
                      ) : (
                        activityModal.data.votes.map((v) => (
                          <div key={v.id} className="p-3 bg-gray-800 rounded-lg flex items-center gap-4">
                            <span
                              className={`w-8 h-8 flex items-center justify-center rounded ${
                                v.value === 1 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {v.value === 1 ? "+" : "-"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-300 truncate">{v.commentPreview}</p>
                              <p className="text-gray-500 text-xs">by {v.commentAuthor}</p>
                            </div>
                            <span className="text-gray-500 text-xs">{formatDate(v.createdAt)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activityTab === "ratings" && (
                    <div className="space-y-2">
                      {activityModal.data.ratings.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">No ratings</div>
                      ) : (
                        activityModal.data.ratings.map((r) => (
                          <div key={r.id} className="p-3 bg-gray-800 rounded-lg flex items-center gap-4">
                            <span className="text-yellow-400 text-lg">
                              {"★".repeat(r.score)}
                              <span className="text-gray-600">{"★".repeat(5 - r.score)}</span>
                            </span>
                            <div className="flex-1">
                              <p className="text-gray-400 text-sm">{r.videoId.slice(0, 12)}...</p>
                            </div>
                            <span className="text-gray-500 text-xs">{formatDate(r.createdAt)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
