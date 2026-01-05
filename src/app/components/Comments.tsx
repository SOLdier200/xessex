"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";

type Comment = {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  userVote: number | null;
};

type AuthStatus = {
  authenticated: boolean;
  isDiamond: boolean;
};

function getVisitorId(): string {
  if (typeof window === "undefined") return "";

  let visitorId = localStorage.getItem("xessex_visitor_id");
  if (!visitorId) {
    visitorId = "v_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("xessex_visitor_id", visitorId);
  }
  return visitorId;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }) + " at " + date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Comments({ viewkey }: { viewkey: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [visitorId, setVisitorId] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false, isDiamond: false });

  useEffect(() => {
    setVisitorId(getVisitorId());

    // Check auth status
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setAuthStatus({
            authenticated: data.authenticated,
            isDiamond: data.isDiamond,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!visitorId) return;

    fetch(`/api/comments?viewkey=${viewkey}&visitorId=${visitorId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setComments(data.comments);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [viewkey, visitorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewkey,
          text: text.trim(),
          authorName: authorName.trim() || "Anonymous",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setComments([data.comment, ...comments]);
        setText("");
        toast.success("Comment posted!");
      } else {
        toast.error(data.error || "Failed to post comment");
      }
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (commentId: string, vote: 1 | -1) => {
    if (!visitorId) return;

    try {
      const res = await fetch("/api/comments/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          visitorId,
          vote,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setComments(
          comments.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  upvotes: data.upvotes,
                  downvotes: data.downvotes,
                  userVote: data.userVote,
                }
              : c
          )
        );
      }
    } catch {
      toast.error("Failed to vote");
    }
  };

  return (
    <div className="mt-6 neon-border rounded-2xl p-4 md:p-6 bg-black/30">
      <h3 className="text-lg font-semibold neon-text mb-4">
        Comments ({comments.length})
      </h3>

      {/* Comment Form - Diamond Members Only */}
      {authStatus.isDiamond ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="text"
              placeholder="Name (optional)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="flex-shrink-0 sm:w-40 rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40 text-sm"
              maxLength={50}
            />
            <textarea
              placeholder="Write a comment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 rounded-xl bg-black/40 neon-border px-3 py-2 text-white placeholder:text-white/40 text-sm resize-none"
              rows={2}
              maxLength={1000}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">{text.length}/1000</span>
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="px-4 py-2 rounded-xl bg-pink-500/80 hover:bg-pink-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium transition"
            >
              {submitting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 rounded-xl bg-black/20 border border-yellow-400/30 text-center">
          <p className="text-white/70 text-sm mb-2">
            Only Diamond Members can post comments
          </p>
          <Link
            href="/signup"
            className="inline-block px-4 py-2 rounded-xl bg-yellow-500/80 hover:bg-yellow-500 text-black text-sm font-medium transition"
          >
            Become a Diamond Member
          </Link>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="text-center text-white/50 py-8">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-center text-white/50 py-8">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-black/20 rounded-xl p-3 md:p-4 border border-white/10"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                <span className="font-medium text-pink-300 text-sm">
                  {comment.authorName}
                </span>
                <span className="text-xs text-white/40">
                  {formatDate(comment.createdAt)}
                </span>
              </div>
              <p className="text-white/90 text-sm mb-3 whitespace-pre-wrap break-words">
                {comment.text}
              </p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleVote(comment.id, 1)}
                  className={`flex items-center gap-1 text-sm transition ${
                    comment.userVote === 1
                      ? "text-green-400"
                      : "text-white/50 hover:text-green-400"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill={comment.userVote === 1 ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                    />
                  </svg>
                  <span>{comment.upvotes}</span>
                </button>
                <button
                  onClick={() => handleVote(comment.id, -1)}
                  className={`flex items-center gap-1 text-sm transition ${
                    comment.userVote === -1
                      ? "text-red-400"
                      : "text-white/50 hover:text-red-400"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill={comment.userVote === -1 ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                    />
                  </svg>
                  <span>{comment.downvotes}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
