"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
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
  autoBlocked: boolean;
  lastWarning: {
    createdAt: string;
    acknowledged: boolean;
    autoBlocked?: boolean;
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

interface RewardHeldUser {
  id: string;
  email: string | null;
  wallet: string | null;
  rewardBanStatus: string;
  rewardBanUntil: string | null;
  rewardBanReason: string | null;
  claimFrozen: boolean;
  claimFrozenUntil: string | null;
  claimFrozenReason: string | null;
  globalBanStatus: string;
  globalBanReason: string | null;
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
    rewardBanStatus: string;
    rewardBanUntil: string | null;
    rewardBanReason: string | null;
    claimFrozen: boolean;
    claimFrozenUntil: string | null;
    claimFrozenReason: string | null;
    globalBanStatus: string;
    globalBanReason: string | null;
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

export default function AdminUnrulyUsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Unruly users state
  const [commentSpammers, setCommentSpammers] = useState<CommentSpammer[]>([]);
  const [dislikeSpammers, setDislikeSpammers] = useState<DislikeSpammer[]>([]);
  const [starAbusers, setStarAbusers] = useState<StarAbuser[]>([]);
  const [rewardHeld, setRewardHeld] = useState<RewardHeldUser[]>([]);
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
    targetType: "comment" | "vote" | "rating" | "reward";
    duration?: string;
    weeks?: number;
    userDisplay: string;
  } | null>(null);

  // Global ban modal state
  const [globalBanModal, setGlobalBanModal] = useState<{
    open: boolean;
    userId: string;
    userDisplay: string;
    banIps: boolean;
    reason: string;
  } | null>(null);

  // Claim freeze modal state
  const [claimFreezeModal, setClaimFreezeModal] = useState<{
    open: boolean;
    userId: string;
    userDisplay: string;
    weeks: string;
    reason: string;
  } | null>(null);

  // Custom weeks input for ban actions
  const [banWeeksInput, setBanWeeksInput] = useState<string>("");
  // Per-card weeks inputs in activity modal
  const [cardWeeks, setCardWeeks] = useState<Record<string, string>>({ comment: "", vote: "", rating: "", reward: "", claim: "" });

  // User activity modal state
  const [activityModal, setActivityModal] = useState<{
    open: boolean;
    loading: boolean;
    userId: string;
    data: UserActivity | null;
  } | null>(null);

  // Active tab for activity modal
  const [activityTab, setActivityTab] = useState<"comments" | "votes" | "ratings">("comments");

  // Revoke 1-star ratings modal state
  const [revoke1StarModal, setRevoke1StarModal] = useState<{
    open: boolean;
    userId: string;
    userDisplay: string;
    oneStarCount: number;
  } | null>(null);

  const fetchUnrulyUsers = useCallback(async () => {
    setUnrulyLoading(true);
    try {
      const res = await fetch("/api/mod/unruly-users", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setCommentSpammers(data.commentSpammers || []);
        setDislikeSpammers(data.dislikeSpammers || []);
        setStarAbusers(data.starAbusers || []);
        setRewardHeld(data.rewardHeld || []);
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

        // Check if user is ADMIN
        if (data.user.role !== "ADMIN") {
          setError("Access denied. Admin privileges required.");
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
    targetType: "comment" | "vote" | "rating" | "reward",
    duration?: string,
    weeks?: number
  ) => {
    setActionLoading(userId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/mod/ban-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, action, targetType, duration, weeks }),
      });

      const data = await res.json();

      if (data.ok) {
        const successMsg = action === "ban"
          ? `Successfully suspended ${targetType} for ${data.duration || "unknown duration"}`
          : `Successfully restored ${targetType} ability`;
        setActionSuccess(successMsg);
        toast.success(successMsg);
        await Promise.all([fetchUnrulyUsers(), fetchBannedUsers()]);
        if (activityModal?.data) {
          fetchUserActivity(activityModal.userId);
        }
      } else {
        const errorMsg = data.error || "Action failed";
        setActionError(errorMsg);
        toast.error(errorMsg);
      }
    } catch {
      setActionError("Failed to perform action");
      toast.error("Failed to perform action");
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleClaimFreeze = async (userId: string, action: "freeze" | "unfreeze", weeks?: number, reason?: string) => {
    setActionLoading(userId);
    setActionError(null);
    try {
      const res = await fetch("/api/mod/claim-freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, action, weeks, reason }),
      });
      const data = await res.json();
      if (data.ok) {
        const successMsg = action === "freeze" ? "Claim button frozen" : "Claim button unfrozen";
        setActionSuccess(successMsg);
        toast.success(successMsg);
        if (activityModal?.data) fetchUserActivity(activityModal.userId);
        await fetchUnrulyUsers();
      } else {
        const errorMsg = data.error || "Action failed";
        setActionError(errorMsg);
        toast.error(errorMsg);
      }
    } catch {
      setActionError("Failed to perform action");
      toast.error("Failed to perform action");
    } finally {
      setActionLoading(null);
      setClaimFreezeModal(null);
    }
  };

  const handleGlobalBan = async (userId: string, reason: string, banIps: boolean) => {
    setActionLoading(userId);
    setActionError(null);
    try {
      const res = await fetch("/api/mod/global-ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, reason, banIps }),
      });
      const data = await res.json();
      if (data.ok) {
        const successMsg = `User globally banned${data.ipsBanned > 0 ? ` (${data.ipsBanned} IPs banned)` : ""}`;
        setActionSuccess(successMsg);
        toast.success(successMsg);
        if (activityModal?.data) fetchUserActivity(activityModal.userId);
        await Promise.all([fetchUnrulyUsers(), fetchBannedUsers()]);
      } else {
        const errorMsg = data.error || "Action failed";
        setActionError(errorMsg);
        toast.error(errorMsg);
      }
    } catch {
      setActionError("Failed to perform action");
      toast.error("Failed to perform action");
    } finally {
      setActionLoading(null);
      setGlobalBanModal(null);
    }
  };

  const openConfirmModal = (
    userId: string,
    action: "ban" | "unban",
    targetType: "comment" | "vote" | "rating" | "reward",
    userDisplay: string,
    duration?: string,
    weeks?: number
  ) => {
    setConfirmModal({ open: true, userId, action, targetType, duration, weeks, userDisplay });
  };

  const handleRevoke1StarRatings = async (userId: string) => {
    setActionLoading(userId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/mod/users/revoke-1star-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (data.ok) {
        setActionSuccess(`Successfully revoked ${data.deletedCount} 1-star rating(s)`);
        // Refresh user activity if modal is open
        if (activityModal?.data) {
          fetchUserActivity(activityModal.userId);
        }
        // Refresh unruly users list
        await fetchUnrulyUsers();
      } else {
        setActionError(data.error || "Failed to revoke ratings");
      }
    } catch (err) {
      setActionError("Failed to revoke 1-star ratings");
    } finally {
      setActionLoading(null);
      setRevoke1StarModal(null);
    }
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
        <Link href="/admin/controls" className="text-pink-500 hover:text-pink-400 underline">
          Back to Admin
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
            <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
              Unruly Users
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {user?.email || "Admin"}
            </span>
            <Link
              href="/admin/controls"
              className="px-4 py-2 bg-pink-500/20 text-pink-400 rounded-lg hover:bg-pink-500/30 transition"
            >
              Admin Console
            </Link>
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
        <h1 className="text-3xl font-bold mb-8">Unruly Users</h1>

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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Comment Spammers</h3>
            <p className="text-3xl font-bold text-orange-500">{commentSpammers.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Dislike Spammers</h3>
            <p className="text-3xl font-bold text-purple-500">{dislikeSpammers.length}</p>
          </div>
          <div className={`bg-gray-900 border rounded-xl p-6 ${starAbusers.filter((u) => u.autoBlocked).length > 0 ? "border-red-500/50" : "border-gray-800"}`}>
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Star Abusers</h3>
            <p className="text-3xl font-bold text-yellow-600">{starAbusers.length}</p>
            {starAbusers.filter((u) => u.autoBlocked).length > 0 && (
              <p className="text-sm text-red-400 mt-1">
                {starAbusers.filter((u) => u.autoBlocked).length} auto-blocked
              </p>
            )}
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
          <div className={`bg-gray-900 border rounded-xl p-6 ${rewardHeld.length > 0 ? "border-cyan-500/50" : "border-gray-800"}`}>
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Reward Held</h3>
            <p className="text-3xl font-bold text-cyan-500">{rewardHeld.length}</p>
            {rewardHeld.filter((u) => u.globalBanStatus === "PERM_BANNED").length > 0 && (
              <p className="text-sm text-red-400 mt-1">
                {rewardHeld.filter((u) => u.globalBanStatus === "PERM_BANNED").length} global banned
              </p>
            )}
          </div>
        </div>

        {/* Unruly Users Section - Consolidated View */}
        <div className="bg-gray-900 border border-red-500/30 rounded-xl mb-8">
          <div className="p-6 border-b border-red-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-red-400">Unruly Users</h2>
                  <p className="text-sm text-gray-400">All users with offenses - click any row for details and actions</p>
                </div>
              </div>
              <button
                onClick={() => { fetchUnrulyUsers(); fetchBannedUsers(); }}
                disabled={unrulyLoading || bannedLoading}
                className="px-3 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition text-sm"
              >
                {unrulyLoading || bannedLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="p-6">
            {unrulyLoading || bannedLoading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : (() => {
              // Consolidate all unruly users into a single list
              const userMap = new Map<string, {
                id: string;
                email: string | null;
                wallet: string | null;
                createdAt: string;
                offenses: {
                  commentSpam?: { removedCount: number; status: string };
                  dislikeSpam?: { ratio: number; total: number; dislikes: number; status: string };
                  starAbuse?: { count: number; autoBlocked: boolean; status: string };
                  rewardHeld?: { status: string; claimFrozen: boolean; globalBan: string };
                  commentBan?: { status: string; removedCount: number; banUntil: string | null };
                };
              }>();

              // Add comment spammers
              commentSpammers.forEach((u) => {
                const existing = userMap.get(u.id) || { id: u.id, email: u.email, wallet: u.wallet, createdAt: u.createdAt, offenses: {} };
                existing.offenses.commentSpam = { removedCount: u.removedCount, status: u.status };
                userMap.set(u.id, existing);
              });

              // Add dislike spammers
              dislikeSpammers.forEach((u) => {
                const existing = userMap.get(u.id) || { id: u.id, email: u.email, wallet: u.wallet, createdAt: u.createdAt, offenses: {} };
                existing.offenses.dislikeSpam = { ratio: u.dislikeRatio, total: u.totalVotes, dislikes: u.dislikes, status: u.status };
                userMap.set(u.id, existing);
              });

              // Add star abusers
              starAbusers.forEach((u) => {
                const existing = userMap.get(u.id) || { id: u.id, email: u.email, wallet: u.wallet, createdAt: u.createdAt, offenses: {} };
                existing.offenses.starAbuse = { count: u.oneStarCount, autoBlocked: u.autoBlocked, status: u.status };
                userMap.set(u.id, existing);
              });

              // Add reward held users
              rewardHeld.forEach((u) => {
                const existing = userMap.get(u.id) || { id: u.id, email: u.email, wallet: u.wallet, createdAt: u.createdAt, offenses: {} };
                existing.offenses.rewardHeld = { status: u.rewardBanStatus, claimFrozen: u.claimFrozen, globalBan: u.globalBanStatus };
                userMap.set(u.id, existing);
              });

              // Add comment banned users
              bannedUsers.forEach((u) => {
                const existing = userMap.get(u.id) || { id: u.id, email: u.email, wallet: u.wallet, createdAt: u.createdAt, offenses: {} };
                existing.offenses.commentBan = { status: u.status, removedCount: u.removedCount, banUntil: u.banUntil };
                userMap.set(u.id, existing);
              });

              const allUsers = Array.from(userMap.values());

              if (allUsers.length === 0) {
                return <div className="text-center text-gray-500 py-8">No unruly users found</div>;
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 text-sm">
                        <th className="pb-3 font-medium">User</th>
                        <th className="pb-3 font-medium text-center">
                          <span className="text-orange-400" title="Comment Spam (3+ removed)">Comment</span>
                        </th>
                        <th className="pb-3 font-medium text-center">
                          <span className="text-purple-400" title="Dislike Spam (75%+ dislikes)">Dislike</span>
                        </th>
                        <th className="pb-3 font-medium text-center">
                          <span className="text-yellow-500" title="Star Abuse (10+ 1-star)">Star</span>
                        </th>
                        <th className="pb-3 font-medium text-center">
                          <span className="text-cyan-400" title="Reward/Claim/Global">Reward</span>
                        </th>
                        <th className="pb-3 font-medium text-center">
                          <span className="text-red-400" title="Comment Ban Status">Banned</span>
                        </th>
                        <th className="pb-3 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {allUsers.map((u) => {
                        const hasAutoBlock = u.offenses.starAbuse?.autoBlocked;
                        const hasGlobalBan = u.offenses.rewardHeld?.globalBan === "PERM_BANNED";
                        return (
                          <tr
                            key={u.id}
                            onClick={() => fetchUserActivity(u.id)}
                            className={`hover:bg-gray-800/50 cursor-pointer transition ${hasGlobalBan ? "bg-red-500/10" : hasAutoBlock ? "bg-yellow-500/5" : ""}`}
                          >
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="font-medium text-white hover:text-pink-400">
                                    {getUserDisplay(u)}
                                  </div>
                                  <div className="text-xs text-gray-500">{u.id.slice(0, 12)}...</div>
                                </div>
                                {hasGlobalBan && (
                                  <span className="px-1.5 py-0.5 bg-red-500/30 text-red-400 rounded text-xs font-bold">
                                    GLOBAL BAN
                                  </span>
                                )}
                                {hasAutoBlock && !hasGlobalBan && (
                                  <span className="px-1.5 py-0.5 bg-yellow-500/30 text-yellow-400 rounded text-xs font-bold animate-pulse">
                                    AUTO-BLOCKED
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 text-center">
                              {u.offenses.commentSpam ? (
                                <span className={`font-bold ${u.offenses.commentSpam.removedCount >= 5 ? "text-red-400" : "text-orange-400"}`}>
                                  {u.offenses.commentSpam.removedCount}
                                </span>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="py-3 text-center">
                              {u.offenses.dislikeSpam ? (
                                <span className={`font-bold ${u.offenses.dislikeSpam.ratio >= 90 ? "text-red-400" : "text-purple-400"}`}>
                                  {u.offenses.dislikeSpam.ratio}%
                                </span>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="py-3 text-center">
                              {u.offenses.starAbuse ? (
                                <span className={`font-bold ${u.offenses.starAbuse.autoBlocked ? "text-red-400" : u.offenses.starAbuse.count >= 20 ? "text-red-400" : "text-yellow-500"}`}>
                                  {u.offenses.starAbuse.count}★
                                </span>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="py-3 text-center">
                              {u.offenses.rewardHeld ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  {u.offenses.rewardHeld.globalBan === "PERM_BANNED" && (
                                    <span className="text-xs text-red-400 font-bold">GLOBAL</span>
                                  )}
                                  {u.offenses.rewardHeld.claimFrozen && (
                                    <span className="text-xs text-blue-400">Frozen</span>
                                  )}
                                  {u.offenses.rewardHeld.status !== "ALLOWED" && u.offenses.rewardHeld.status !== "UNBANNED" && (
                                    <span className="text-xs text-cyan-400">Held</span>
                                  )}
                                  {u.offenses.rewardHeld.status === "ALLOWED" && !u.offenses.rewardHeld.claimFrozen && u.offenses.rewardHeld.globalBan !== "PERM_BANNED" && (
                                    <span className="text-gray-600">—</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="py-3 text-center">
                              {u.offenses.commentBan ? (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  u.offenses.commentBan.status === "PERM_BANNED" ? "bg-red-500/20 text-red-400" :
                                  u.offenses.commentBan.status === "TEMP_BANNED" ? "bg-yellow-500/20 text-yellow-400" :
                                  u.offenses.commentBan.status === "UNBANNED" ? "bg-gray-500/20 text-gray-400" :
                                  "bg-green-500/20 text-green-400"
                                }`}>
                                  {u.offenses.commentBan.status === "PERM_BANNED" ? "Perm" :
                                   u.offenses.commentBan.status === "TEMP_BANNED" ? "Temp" :
                                   u.offenses.commentBan.status === "UNBANNED" ? "Was" : "OK"}
                                </span>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="py-3 text-gray-400 text-sm">{formatDate(u.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>

        <ReportedCommentsPanel />
      </main>

      {/* Confirmation Modal */}
      {confirmModal?.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-2">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
              {confirmModal.action === "unban"
                ? `Restore ${confirmModal.targetType} ability`
                : `Suspend ${confirmModal.targetType} ability`}
            </h3>
            <p className="text-gray-300 text-sm sm:text-base mb-3 sm:mb-4">
              Are you sure you want to{" "}
              <span className={confirmModal.action === "unban" ? "text-green-400" : "text-red-400"}>
                {confirmModal.action === "unban" ? "restore" : "suspend"}
              </span>{" "}
              <span className="font-medium text-white">{confirmModal.targetType}</span> ability for{" "}
              <span className="font-medium text-white break-all">{confirmModal.userDisplay}</span>?
            </p>
            {confirmModal.action === "ban" && (confirmModal.duration || confirmModal.weeks) && (
              <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                Duration:{" "}
                <span className="text-white">
                  {confirmModal.weeks
                    ? `${confirmModal.weeks} week${confirmModal.weeks === 1 ? "" : "s"}`
                    : confirmModal.duration === "1_week" ? "1 week"
                    : confirmModal.duration === "2_week" ? "2 weeks"
                    : confirmModal.duration === "4_week" ? "4 weeks"
                    : "Permanent"}
                </span>
              </p>
            )}
            {confirmModal.action === "ban" && !confirmModal.duration && !confirmModal.weeks && (
              <div className="mb-4">
                <label className="text-sm text-gray-400 block mb-1">Duration (weeks, 0 = permanent)</label>
                <input
                  type="number"
                  min="0"
                  value={banWeeksInput}
                  onChange={(e) => setBanWeeksInput(e.target.value)}
                  placeholder="e.g. 3"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
            )}
            <div className="flex gap-2 sm:gap-3 justify-end">
              <button
                onClick={() => { setConfirmModal(null); setBanWeeksInput(""); }}
                className="px-3 sm:px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const weeks = confirmModal.weeks ?? (banWeeksInput !== "" ? parseInt(banWeeksInput) : undefined);
                  handleBanAction(
                    confirmModal.userId,
                    confirmModal.action,
                    confirmModal.targetType,
                    confirmModal.duration,
                    weeks
                  );
                  setBanWeeksInput("");
                }}
                disabled={actionLoading === confirmModal.userId}
                className={`px-3 sm:px-4 py-2 rounded-lg transition disabled:opacity-50 text-sm sm:text-base ${
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

      {/* Global Ban Modal */}
      {globalBanModal?.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-2">
          <div className="bg-gray-900 border border-red-500/50 rounded-xl p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg sm:text-xl font-bold mb-3 text-red-400">Global Ban User</h3>
            <p className="text-gray-300 text-sm mb-4">
              This will <span className="text-red-400 font-bold">permanently ban</span>{" "}
              <span className="text-white font-medium break-all">{globalBanModal.userDisplay}</span> from the platform.
              Their wallet will be blocked, sessions killed, rewards held, and claims frozen.
            </p>
            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-1">Reason</label>
              <input
                type="text"
                value={globalBanModal.reason}
                onChange={(e) => setGlobalBanModal({ ...globalBanModal, reason: e.target.value })}
                placeholder="Reason for ban..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-red-500 focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 mb-4 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={globalBanModal.banIps}
                onChange={(e) => setGlobalBanModal({ ...globalBanModal, banIps: e.target.checked })}
                className="rounded"
              />
              Also ban known IP addresses
              <span className="text-xs text-gray-500">(may affect shared networks)</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setGlobalBanModal(null)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleGlobalBan(globalBanModal.userId, globalBanModal.reason, globalBanModal.banIps)}
                disabled={actionLoading === globalBanModal.userId}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition text-sm disabled:opacity-50"
              >
                {actionLoading === globalBanModal.userId ? "Banning..." : "Permanently Ban"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Freeze Modal */}
      {claimFreezeModal?.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-2">
          <div className="bg-gray-900 border border-blue-500/50 rounded-xl p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg sm:text-xl font-bold mb-3 text-blue-400">Freeze Claim Button</h3>
            <p className="text-gray-300 text-sm mb-4">
              Freeze the claim button for{" "}
              <span className="text-white font-medium break-all">{claimFreezeModal.userDisplay}</span>.
              Leave weeks blank for indefinite freeze.
            </p>
            <div className="mb-3">
              <label className="text-sm text-gray-400 block mb-1">Weeks (leave blank = indefinite)</label>
              <input
                type="number"
                min="0"
                value={claimFreezeModal.weeks}
                onChange={(e) => setClaimFreezeModal({ ...claimFreezeModal, weeks: e.target.value })}
                placeholder="e.g. 3"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-1">Reason (optional)</label>
              <input
                type="text"
                value={claimFreezeModal.reason}
                onChange={(e) => setClaimFreezeModal({ ...claimFreezeModal, reason: e.target.value })}
                placeholder="Reason..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setClaimFreezeModal(null)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleClaimFreeze(
                  claimFreezeModal.userId,
                  "freeze",
                  claimFreezeModal.weeks ? parseInt(claimFreezeModal.weeks) : undefined,
                  claimFreezeModal.reason || undefined
                )}
                disabled={actionLoading === claimFreezeModal.userId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition text-sm disabled:opacity-50"
              >
                {actionLoading === claimFreezeModal.userId ? "Freezing..." : "Freeze Claims"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke 1-Star Ratings Modal */}
      {revoke1StarModal?.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-2">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-purple-400">
              Revoke 1-Star Ratings
            </h3>
            <p className="text-gray-300 text-sm sm:text-base mb-3 sm:mb-4">
              Are you sure you want to <span className="text-purple-400 font-medium">permanently delete</span> all{" "}
              <span className="text-white font-bold">{revoke1StarModal.oneStarCount}</span> 1-star rating(s) from{" "}
              <span className="font-medium text-white break-all">{revoke1StarModal.userDisplay}</span>?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              This action cannot be undone. Video rankings will be recalculated.
            </p>
            <div className="flex gap-2 sm:gap-3 justify-end">
              <button
                onClick={() => setRevoke1StarModal(null)}
                className="px-3 sm:px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke1StarRatings(revoke1StarModal.userId)}
                disabled={actionLoading === revoke1StarModal.userId}
                className="px-3 sm:px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition disabled:opacity-50 text-sm sm:text-base"
              >
                {actionLoading === revoke1StarModal.userId ? "Revoking..." : "Revoke All 1★"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Activity Modal */}
      {activityModal?.open && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-gray-700 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl font-bold">User Activity Review</h3>
                {activityModal.data && (
                  <p className="text-gray-400 text-xs sm:text-sm mt-1 truncate">
                    {activityModal.data.user.email || activityModal.data.user.wallet || activityModal.data.user.id}
                  </p>
                )}
              </div>
              <button
                onClick={() => setActivityModal(null)}
                className="text-gray-400 hover:text-white transition shrink-0"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {activityModal.loading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-pink-500">Loading user activity...</div>
              </div>
            ) : activityModal.data ? (
              <div className="flex-1 overflow-y-auto">
                {/* Summary Stats */}
                <div className="p-4 sm:p-6 border-b border-gray-700">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                      <h4 className="text-gray-400 text-sm mb-2">Comments</h4>
                      <div className="flex gap-3 sm:gap-4 flex-wrap">
                        <div>
                          <span className="text-xl sm:text-2xl font-bold text-white">{activityModal.data.summary.comments.total}</span>
                          <span className="text-gray-500 text-xs sm:text-sm ml-1">total</span>
                        </div>
                        <div>
                          <span className="text-green-400 font-medium">{activityModal.data.summary.comments.active}</span>
                          <span className="text-gray-500 text-xs sm:text-sm ml-1">active</span>
                        </div>
                        <div>
                          <span className="text-red-400 font-medium">{activityModal.data.summary.comments.removed}</span>
                          <span className="text-gray-500 text-xs sm:text-sm ml-1">removed</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                      <h4 className="text-gray-400 text-sm mb-2">Votes</h4>
                      <div className="flex gap-3 sm:gap-4 flex-wrap">
                        <div>
                          <span className="text-xl sm:text-2xl font-bold text-white">{activityModal.data.summary.votes.total}</span>
                          <span className="text-gray-500 text-xs sm:text-sm ml-1">total</span>
                        </div>
                        <div>
                          <span className="text-green-400 font-medium">{activityModal.data.summary.votes.likes}</span>
                          <span className="text-gray-500 text-xs sm:text-sm ml-1">likes</span>
                        </div>
                        <div>
                          <span className="text-red-400 font-medium">{activityModal.data.summary.votes.dislikes}</span>
                          <span className="text-gray-500 text-xs sm:text-sm ml-1">dislikes</span>
                          <span className="text-purple-400 text-xs ml-1">({activityModal.data.summary.votes.dislikeRatio}%)</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                      <h4 className="text-gray-400 text-sm mb-2">Ratings</h4>
                      <div className="flex gap-3 sm:gap-4 flex-wrap">
                        <div>
                          <span className="text-xl sm:text-2xl font-bold text-white">{activityModal.data.summary.ratings.total}</span>
                          <span className="text-gray-500 text-xs sm:text-sm ml-1">total</span>
                        </div>
                        <div>
                          <span className="text-yellow-400 font-medium">{activityModal.data.summary.ratings.average}</span>
                          <span className="text-gray-500 text-xs sm:text-sm ml-1">avg</span>
                        </div>
                      </div>
                      <div className="flex gap-1 sm:gap-2 mt-2 text-xs flex-wrap">
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
                <div className="p-4 sm:p-6 border-b border-gray-700">
                  <h4 className="text-gray-400 text-sm mb-3 sm:mb-4 uppercase tracking-wide">Moderation Actions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    {/* Comment Status */}
                    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-white font-medium">Comments</h5>
                        {getStatusBadge(activityModal.data.user.commentBanStatus)}
                      </div>
                      {activityModal.data.user.commentBanUntil && (
                        <p className="text-yellow-400 text-xs mb-2">
                          Until: {formatDate(activityModal.data.user.commentBanUntil)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3 items-center">
                        {activityModal.data.user.commentBanStatus !== "ALLOWED" &&
                         activityModal.data.user.commentBanStatus !== "WARNED" &&
                         activityModal.data.user.commentBanStatus !== "UNBANNED" ? (
                          <button
                            onClick={() => openConfirmModal(activityModal.userId, "unban", "comment", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId)}
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="1"
                              max="52"
                              placeholder="Wks"
                              value={cardWeeks.comment}
                              onChange={(e) => setCardWeeks((p) => ({ ...p, comment: e.target.value }))}
                              className="w-14 px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white text-center"
                            />
                            <button
                              disabled={!cardWeeks.comment || parseInt(cardWeeks.comment) < 1}
                              onClick={() => {
                                const w = parseInt(cardWeeks.comment);
                                if (w > 0) openConfirmModal(activityModal.userId, "ban", "comment", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, undefined, w);
                              }}
                              className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30 disabled:opacity-40"
                            >
                              Ban
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
                    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-white font-medium">Votes</h5>
                        {getStatusBadge(activityModal.data.user.voteBanStatus)}
                      </div>
                      {activityModal.data.user.voteBanUntil && (
                        <p className="text-yellow-400 text-xs mb-2">
                          Until: {formatDate(activityModal.data.user.voteBanUntil)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3 items-center">
                        {activityModal.data.user.voteBanStatus !== "ALLOWED" &&
                         activityModal.data.user.voteBanStatus !== "WARNED" &&
                         activityModal.data.user.voteBanStatus !== "UNBANNED" ? (
                          <button
                            onClick={() => openConfirmModal(activityModal.userId, "unban", "vote", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId)}
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="1"
                              max="52"
                              placeholder="Wks"
                              value={cardWeeks.vote}
                              onChange={(e) => setCardWeeks((p) => ({ ...p, vote: e.target.value }))}
                              className="w-14 px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white text-center"
                            />
                            <button
                              disabled={!cardWeeks.vote || parseInt(cardWeeks.vote) < 1}
                              onClick={() => {
                                const w = parseInt(cardWeeks.vote);
                                if (w > 0) openConfirmModal(activityModal.userId, "ban", "vote", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, undefined, w);
                              }}
                              className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30 disabled:opacity-40"
                            >
                              Ban
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
                    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-white font-medium">Ratings</h5>
                        {getStatusBadge(activityModal.data.user.ratingBanStatus)}
                      </div>
                      {activityModal.data.user.ratingBanUntil && (
                        <p className="text-yellow-400 text-xs mb-2">
                          Until: {formatDate(activityModal.data.user.ratingBanUntil)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3 items-center">
                        {activityModal.data.user.ratingBanStatus !== "ALLOWED" &&
                         activityModal.data.user.ratingBanStatus !== "WARNED" &&
                         activityModal.data.user.ratingBanStatus !== "UNBANNED" ? (
                          <button
                            onClick={() => openConfirmModal(activityModal.userId, "unban", "rating", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId)}
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="1"
                              max="52"
                              placeholder="Wks"
                              value={cardWeeks.rating}
                              onChange={(e) => setCardWeeks((p) => ({ ...p, rating: e.target.value }))}
                              className="w-14 px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white text-center"
                            />
                            <button
                              disabled={!cardWeeks.rating || parseInt(cardWeeks.rating) < 1}
                              onClick={() => {
                                const w = parseInt(cardWeeks.rating);
                                if (w > 0) openConfirmModal(activityModal.userId, "ban", "rating", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, undefined, w);
                              }}
                              className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30 disabled:opacity-40"
                            >
                              Ban
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
                      {/* Revoke 1-star ratings for star abuse */}
                      {activityModal.data.summary.ratings.breakdown[1] > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <button
                            onClick={() => setRevoke1StarModal({
                              open: true,
                              userId: activityModal.userId,
                              userDisplay: activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId,
                              oneStarCount: activityModal.data!.summary.ratings.breakdown[1],
                            })}
                            className="w-full px-3 py-2 bg-purple-500/20 text-purple-400 rounded text-xs hover:bg-purple-500/30 flex items-center justify-center gap-2"
                          >
                            <span>Revoke all 1★ ratings</span>
                            <span className="bg-purple-500/30 px-1.5 py-0.5 rounded">
                              {activityModal.data.summary.ratings.breakdown[1]}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Reward Status */}
                    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-white font-medium">Rewards</h5>
                        {getStatusBadge(activityModal.data.user.rewardBanStatus)}
                      </div>
                      {activityModal.data.user.rewardBanUntil && (
                        <p className="text-yellow-400 text-xs mb-2">
                          Until: {formatDate(activityModal.data.user.rewardBanUntil)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3 items-center">
                        {activityModal.data.user.rewardBanStatus !== "ALLOWED" &&
                         activityModal.data.user.rewardBanStatus !== "WARNED" &&
                         activityModal.data.user.rewardBanStatus !== "UNBANNED" ? (
                          <button
                            onClick={() => openConfirmModal(activityModal.userId, "unban", "reward", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId)}
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="1"
                              max="52"
                              placeholder="Wks"
                              value={cardWeeks.reward}
                              onChange={(e) => setCardWeeks((p) => ({ ...p, reward: e.target.value }))}
                              className="w-14 px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white text-center"
                            />
                            <button
                              disabled={!cardWeeks.reward || parseInt(cardWeeks.reward) < 1}
                              onClick={() => {
                                const w = parseInt(cardWeeks.reward);
                                if (w > 0) openConfirmModal(activityModal.userId, "ban", "reward", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, undefined, w);
                              }}
                              className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30 disabled:opacity-40"
                            >
                              Ban
                            </button>
                            <button
                              onClick={() => openConfirmModal(activityModal.userId, "ban", "reward", activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId, "permanent")}
                              className="px-2 py-1 bg-red-700/30 text-red-300 rounded text-xs hover:bg-red-700/40"
                            >
                              Perm
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Claim Freeze Status */}
                    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-white font-medium">Claim</h5>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          activityModal.data.user.claimFrozen
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-green-500/20 text-green-400"
                        }`}>
                          {activityModal.data.user.claimFrozen ? "FROZEN" : "ACTIVE"}
                        </span>
                      </div>
                      {activityModal.data.user.claimFrozenUntil && (
                        <p className="text-yellow-400 text-xs mb-2">
                          Until: {formatDate(activityModal.data.user.claimFrozenUntil)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3 items-center">
                        {activityModal.data.user.claimFrozen ? (
                          <button
                            onClick={() => handleClaimFreeze(activityModal.userId, "unfreeze")}
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                          >
                            Unfreeze
                          </button>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="1"
                              max="52"
                              placeholder="Wks"
                              value={cardWeeks.claim}
                              onChange={(e) => setCardWeeks((p) => ({ ...p, claim: e.target.value }))}
                              className="w-14 px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white text-center"
                            />
                            <button
                              onClick={() => {
                                const w = cardWeeks.claim ? parseInt(cardWeeks.claim) : undefined;
                                handleClaimFreeze(activityModal.userId, "freeze", w);
                              }}
                              className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30"
                            >
                              {cardWeeks.claim ? "Freeze" : "Freeze Indef."}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Global Ban */}
                  {activityModal.data.user.globalBanStatus !== "PERM_BANNED" && (
                    <div className="mt-4">
                      <button
                        onClick={() => setGlobalBanModal({
                          open: true,
                          userId: activityModal.userId,
                          userDisplay: activityModal.data!.user.email || activityModal.data!.user.wallet || activityModal.userId,
                          banIps: false,
                          reason: "",
                        })}
                        className="w-full px-4 py-2 bg-red-900/30 text-red-400 border border-red-800/50 rounded-lg text-sm hover:bg-red-900/50 transition"
                      >
                        Global Ban User
                      </button>
                    </div>
                  )}
                  {activityModal.data.user.globalBanStatus === "PERM_BANNED" && (
                    <div className="mt-4 px-4 py-2 bg-red-900/20 border border-red-800/30 rounded-lg text-center">
                      <span className="text-red-400 text-sm font-medium">Globally Banned</span>
                      {activityModal.data.user.globalBanReason && (
                        <span className="text-gray-500 text-xs ml-2">— {activityModal.data.user.globalBanReason}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-700 px-4 sm:px-6 overflow-x-auto">
                  <div className="flex gap-1 sm:gap-4 min-w-max">
                    <button
                      onClick={() => setActivityTab("comments")}
                      className={`py-2 sm:py-3 px-3 sm:px-4 font-medium transition text-sm sm:text-base whitespace-nowrap ${
                        activityTab === "comments"
                          ? "text-pink-400 border-b-2 border-pink-400"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Comments ({activityModal.data.comments.length})
                    </button>
                    <button
                      onClick={() => setActivityTab("votes")}
                      className={`py-2 sm:py-3 px-3 sm:px-4 font-medium transition text-sm sm:text-base whitespace-nowrap ${
                        activityTab === "votes"
                          ? "text-pink-400 border-b-2 border-pink-400"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Votes ({activityModal.data.votes.length})
                    </button>
                    <button
                      onClick={() => setActivityTab("ratings")}
                      className={`py-2 sm:py-3 px-3 sm:px-4 font-medium transition text-sm sm:text-base whitespace-nowrap ${
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
                <div className="p-4 sm:p-6">
                  {activityTab === "comments" && (
                    <div className="space-y-2 sm:space-y-3">
                      {activityModal.data.comments.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">No comments</div>
                      ) : (
                        activityModal.data.comments.map((c) => (
                          <div
                            key={c.id}
                            className={`p-3 sm:p-4 rounded-lg ${
                              c.status === "REMOVED"
                                ? "bg-red-500/10 border border-red-500/30"
                                : "bg-gray-800"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-0 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-gray-400 text-xs">{c.videoId.slice(0, 8)}...</span>
                                {c.status === "REMOVED" && (
                                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                                    REMOVED
                                  </span>
                                )}
                              </div>
                              <span className="text-gray-500 text-xs">{formatDate(c.createdAt)}</span>
                            </div>
                            <p className="text-white text-sm sm:text-base mb-2 break-words">{c.body}</p>
                            <div className="flex gap-3 sm:gap-4 text-xs text-gray-400 flex-wrap">
                              <span className="text-green-400">{c.likes} likes</span>
                              <span className="text-red-400">{c.dislikes} dislikes</span>
                              <span>Score: {c.score}</span>
                            </div>
                            {c.removedReason && (
                              <div className="mt-2 text-xs sm:text-sm text-red-400">
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
                          <div key={v.id} className="p-2 sm:p-3 bg-gray-800 rounded-lg flex items-start sm:items-center gap-2 sm:gap-4">
                            <span
                              className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded shrink-0 ${
                                v.value === 1 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {v.value === 1 ? "+" : "-"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-300 text-sm sm:text-base truncate">{v.commentPreview}</p>
                              <p className="text-gray-500 text-xs">by {v.commentAuthor}</p>
                            </div>
                            <span className="text-gray-500 text-xs shrink-0">{formatDate(v.createdAt)}</span>
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
                          <div key={r.id} className="p-2 sm:p-3 bg-gray-800 rounded-lg flex items-center gap-2 sm:gap-4">
                            <span className="text-yellow-400 text-base sm:text-lg shrink-0">
                              {"★".repeat(r.score)}
                              <span className="text-gray-600">{"★".repeat(5 - r.score)}</span>
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-400 text-xs sm:text-sm truncate">{r.videoId.slice(0, 12)}...</p>
                            </div>
                            <span className="text-gray-500 text-xs shrink-0">{formatDate(r.createdAt)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
