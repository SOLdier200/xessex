"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserData {
  id: string;
  email: string | null;
  walletAddress: string | null;
  role: string;
  createdAt: string;
  stats: {
    totalLikesReceived: number;
    totalCommentsReceived: number;
    totalVotesCast: number;
    totalCommentsMade: number;
    totalXessEarned: string;
  };
}

interface ApiResponse {
  ok: boolean;
  users: UserData[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allowAdmin, setAllowAdmin] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showMakeModModal, setShowMakeModModal] = useState(false);
  const [makingMod, setMakingMod] = useState(false);
  const [highlightedStat, setHighlightedStat] = useState<{ userId: string; stat: string } | null>(null);
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
  const [messageModal, setMessageModal] = useState<{
    open: boolean;
    user: UserData | null;
    subject: string;
    body: string;
    sending: boolean;
  }>({ open: false, user: null, subject: "", body: "", sending: false });
  const [massMessageModal, setMassMessageModal] = useState<{
    open: boolean;
    subject: string;
    body: string;
    sending: boolean;
  }>({ open: false, subject: "", body: "", sending: false });
  const pageSize = 20;

  const fetchUsers = useCallback(async () => {
    if (!allowAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/users?${params}`, { credentials: "include" });
      const data: ApiResponse = await res.json();

      if (!res.ok || !data.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403) {
          router.push("/mod");
          return;
        }
        throw new Error(data.error || "Failed to fetch users");
      }

      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [page, search, router, allowAdmin]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok || !data?.authed || !data?.user) {
          router.push("/login");
          return;
        }
        if (data.user.role !== "ADMIN") {
          router.push("/mod");
          return;
        }
        setAllowAdmin(true);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    if (allowAdmin) fetchUsers();
  }, [allowAdmin, fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleMakeModClick = (user: UserData) => {
    setSelectedUser(user);
    setShowMakeModModal(true);
  };

  const handleConfirmMakeMod = async () => {
    if (!selectedUser) return;

    setMakingMod(true);
    try {
      const res = await fetch("/api/admin/users/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: selectedUser.id, role: "MOD" }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, role: "MOD" } : u))
      );
      setShowMakeModModal(false);
      setSelectedUser(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setMakingMod(false);
    }
  };

  const handleRemoveMod = async (user: UserData) => {
    if (!confirm(`Remove moderator privileges from ${user.email || user.id.slice(0, 8)}?`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/users/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: user.id, role: "USER" }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: "USER" } : u))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleStatClick = (userId: string, stat: string) => {
    if (highlightedStat?.userId === userId && highlightedStat?.stat === stat) {
      setHighlightedStat(null);
    } else {
      setHighlightedStat({ userId, stat });
    }
  };

  const handleSendMessage = async () => {
    if (!messageModal.user || !messageModal.subject.trim() || !messageModal.body.trim()) return;

    setMessageModal((m) => ({ ...m, sending: true }));
    try {
      const res = await fetch("/api/admin/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetUserId: messageModal.user.id,
          subject: messageModal.subject.trim(),
          body: messageModal.body.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setMessageModal({ open: false, user: null, subject: "", body: "", sending: false });
      alert("Message sent successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send message");
      setMessageModal((m) => ({ ...m, sending: false }));
    }
  };

  const handleSendMassMessage = async () => {
    if (!massMessageModal.subject.trim() || !massMessageModal.body.trim()) return;

    if (!confirm("Are you sure you want to send this message to ALL users?")) return;

    setMassMessageModal((m) => ({ ...m, sending: true }));
    try {
      const res = await fetch("/api/admin/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mass: true,
          subject: massMessageModal.subject.trim(),
          body: massMessageModal.body.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send mass message");
      }

      setMassMessageModal({ open: false, subject: "", body: "", sending: false });
      alert(`Mass message sent to ${data.recipientCount} users!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send mass message");
      setMassMessageModal((m) => ({ ...m, sending: false }));
    }
  };

  const formatWallet = (wallet: string | null) => {
    if (!wallet) return "—";
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  const copyWallet = async (wallet: string | null) => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopiedWallet(wallet);
      setTimeout(() => setCopiedWallet(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = wallet;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedWallet(wallet);
      setTimeout(() => setCopiedWallet(null), 2000);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

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
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
              User Management
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/controls"
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition"
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">All Users ({total})</h1>
            <button
              onClick={() => setMassMessageModal({ open: true, subject: "", body: "", sending: false })}
              className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Mass Message
            </button>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or wallet..."
              className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 w-64"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* Users Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800/50 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium">User</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Wallet</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Role</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Likes Recv</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Votes Cast</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Comments Made</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">XESS Earned</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-800/50 transition">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-white">
                            {user.email || `User ${user.id.slice(0, 8)}...`}
                          </div>
                          <div className="text-xs text-gray-500">
                            Joined {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.walletAddress ? (
                          <button
                            onClick={() => copyWallet(user.walletAddress)}
                            className={`font-mono text-sm transition cursor-pointer hover:text-pink-400 ${
                              copiedWallet === user.walletAddress
                                ? "text-green-400"
                                : "text-gray-400"
                            }`}
                            title={`Click to copy: ${user.walletAddress}`}
                          >
                            {copiedWallet === user.walletAddress
                              ? "Copied!"
                              : user.walletAddress}
                          </button>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === "ADMIN"
                              ? "bg-pink-500/20 text-pink-400"
                              : user.role === "MOD"
                              ? "bg-purple-500/20 text-purple-400"
                              : "bg-gray-700 text-gray-400"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-center cursor-pointer transition ${
                          highlightedStat?.userId === user.id && highlightedStat?.stat === "likes"
                            ? "bg-pink-500/20 text-pink-400 font-bold"
                            : "hover:bg-gray-700"
                        }`}
                        onClick={() => handleStatClick(user.id, "likes")}
                      >
                        {user.stats.totalLikesReceived}
                      </td>
                      <td
                        className={`px-4 py-3 text-center cursor-pointer transition ${
                          highlightedStat?.userId === user.id && highlightedStat?.stat === "votes"
                            ? "bg-green-500/20 text-green-400 font-bold"
                            : "hover:bg-gray-700"
                        }`}
                        onClick={() => handleStatClick(user.id, "votes")}
                      >
                        {user.stats.totalVotesCast}
                      </td>
                      <td
                        className={`px-4 py-3 text-center cursor-pointer transition ${
                          highlightedStat?.userId === user.id && highlightedStat?.stat === "commentsMade"
                            ? "bg-yellow-500/20 text-yellow-400 font-bold"
                            : "hover:bg-gray-700"
                        }`}
                        onClick={() => handleStatClick(user.id, "commentsMade")}
                      >
                        {user.stats.totalCommentsMade}
                      </td>
                      <td
                        className={`px-4 py-3 text-right cursor-pointer transition ${
                          highlightedStat?.userId === user.id && highlightedStat?.stat === "xess"
                            ? "bg-purple-500/20 text-purple-400 font-bold"
                            : "hover:bg-gray-700"
                        }`}
                        onClick={() => handleStatClick(user.id, "xess")}
                      >
                        {user.stats.totalXessEarned}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setMessageModal({ open: true, user, subject: "", body: "", sending: false })}
                            className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition text-sm"
                            title="Send Message"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                          {user.role === "ADMIN" ? (
                            <span className="text-gray-600 text-sm">—</span>
                          ) : user.role === "MOD" ? (
                            <button
                              onClick={() => handleRemoveMod(user)}
                              className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition text-sm"
                            >
                              Remove Mod
                            </button>
                          ) : (
                            <button
                              onClick={() => handleMakeModClick(user)}
                              className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition text-sm"
                            >
                              Make Mod
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <div className="text-sm text-gray-500">
                Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Make Mod Modal */}
      {showMakeModModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowMakeModModal(false)}
          />
          <div className="relative w-full max-w-md bg-gray-900 border border-pink-500/30 rounded-2xl p-6">
            <button
              onClick={() => setShowMakeModModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold mb-2">Make User a Moderator?</h2>
              <p className="text-gray-400 mb-6">
                Are you sure you want to give moderator privileges to{" "}
                <span className="text-white font-medium">
                  {selectedUser.email || `User ${selectedUser.id.slice(0, 8)}...`}
                </span>
                ?
              </p>

              <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-gray-400 mb-2">This user will be able to:</p>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Access the Moderator Dashboard</li>
                  <li>• Review and curate videos</li>
                  <li>• View user statistics</li>
                  <li>• Access admin controls</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMakeModModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmMakeMod}
                  disabled={makingMod}
                  className="flex-1 px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition disabled:opacity-50"
                >
                  {makingMod ? "Updating..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {messageModal.open && messageModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMessageModal({ open: false, user: null, subject: "", body: "", sending: false })}
          />
          <div className="relative w-full max-w-lg bg-gray-900 border border-blue-500/30 rounded-2xl p-6">
            <button
              onClick={() => setMessageModal({ open: false, user: null, subject: "", body: "", sending: false })}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Send Message</h2>
                <p className="text-gray-400 text-sm">
                  To: {messageModal.user.email || messageModal.user.id.slice(0, 12)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Subject</label>
                <input
                  type="text"
                  value={messageModal.subject}
                  onChange={(e) => setMessageModal((m) => ({ ...m, subject: e.target.value }))}
                  placeholder="Enter subject..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Message</label>
                <textarea
                  value={messageModal.body}
                  onChange={(e) => setMessageModal((m) => ({ ...m, body: e.target.value }))}
                  placeholder="Type your message..."
                  rows={5}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setMessageModal({ open: false, user: null, subject: "", body: "", sending: false })}
                className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={messageModal.sending || !messageModal.subject.trim() || !messageModal.body.trim()}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {messageModal.sending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mass Message Modal */}
      {massMessageModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMassMessageModal({ open: false, subject: "", body: "", sending: false })}
          />
          <div className="relative w-full max-w-lg bg-gray-900 border border-purple-500/30 rounded-2xl p-6">
            <button
              onClick={() => setMassMessageModal({ open: false, subject: "", body: "", sending: false })}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Mass Message</h2>
                <p className="text-gray-400 text-sm">
                  Send to all {total} users
                </p>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <p className="text-yellow-400 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                This will send a message to ALL users. Use with caution.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Subject</label>
                <input
                  type="text"
                  value={massMessageModal.subject}
                  onChange={(e) => setMassMessageModal((m) => ({ ...m, subject: e.target.value }))}
                  placeholder="Enter subject..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Message</label>
                <textarea
                  value={massMessageModal.body}
                  onChange={(e) => setMassMessageModal((m) => ({ ...m, body: e.target.value }))}
                  placeholder="Type your message..."
                  rows={5}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setMassMessageModal({ open: false, subject: "", body: "", sending: false })}
                className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMassMessage}
                disabled={massMessageModal.sending || !massMessageModal.subject.trim() || !massMessageModal.body.trim()}
                className="flex-1 px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {massMessageModal.sending ? "Sending..." : "Send to All Users"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
