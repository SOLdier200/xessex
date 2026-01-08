"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";

type Comment = {
  id: string;
  body: string;
  authorWallet: string;
  createdAt: string;
  memberLikes: number;
  memberDislikes: number;
  userVote: number | null;
  voteLocked?: boolean;
  secondsLeftToFlip?: number;
};

type AuthStatus = {
  authenticated: boolean;
  tier: "free" | "member" | "diamond";
  canComment: boolean;
  canVoteComments: boolean;
};

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

  return (
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    }) +
    " at " +
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  );
}

interface CommentsProps {
  videoId: string;
  canPost?: boolean;
  canVote?: boolean;
}

export default function Comments({ videoId, canPost, canVote }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    tier: "free",
    canComment: false,
    canVoteComments: false,
  });

  // Use props if provided, otherwise fall back to fetched auth status
  const effectiveCanPost = canPost ?? authStatus.canComment;
  const effectiveCanVote = canVote ?? authStatus.canVoteComments;

  useEffect(() => {
    // Only fetch auth status if props aren't provided
    if (canPost === undefined || canVote === undefined) {
      fetch("/api/auth/status")
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) {
            setAuthStatus({
              authenticated: data.authenticated,
              tier: data.tier,
              canComment: data.canComment,
              canVoteComments: data.canVoteComments,
            });
          }
        })
        .catch(() => {});
    }
  }, [canPost, canVote]);

  useEffect(() => {
    fetch(`/api/comments?videoId=${videoId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setComments(data.comments);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [videoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          text: text.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setComments([data.comment, ...comments]);
        setText("");
        toast.success("Comment posted!");
      } else if (data.error === "DIAMOND_ONLY") {
        toast.error("Only Diamond Members can post comments");
      } else {
        toast.error(data.error || "Failed to post comment");
      }
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (commentId: string, value: 1 | -1) => {
    if (!effectiveCanVote) {
      toast.error("Only paid members can vote on comments");
      return;
    }

    // Check if this comment's vote is locked
    const comment = comments.find((c) => c.id === commentId);
    if (comment?.voteLocked) {
      toast.error("Your vote on this comment is locked");
      return;
    }

    try {
      const res = await fetch("/api/comments/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          value,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setComments(
          comments.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  memberLikes: data.memberLikes,
                  memberDislikes: data.memberDislikes,
                  userVote: data.userVote,
                  voteLocked: data.voteLocked ?? false,
                  secondsLeftToFlip: data.secondsLeftToFlip ?? 0,
                }
              : c
          )
        );
      } else if (data.error === "VOTE_LOCKED_WINDOW_EXPIRED") {
        toast.error("Vote locked: you can only change it within 60 seconds.");
      } else if (data.error === "VOTE_LOCKED_FLIP_ALREADY_USED") {
        toast.error("Vote locked: you can only change your vote once.");
      } else if (data.error === "RATE_LIMIT_1_PER_MINUTE") {
        toast.error("Please wait 1 minute before changing your vote");
      } else if (data.error === "FLIP_LIMIT_REACHED") {
        toast.error("You've reached the maximum vote changes for this comment");
      } else if (data.error === "PAID_ONLY") {
        toast.error("Only paid members can vote on comments");
      } else {
        toast.error(data.error || "Failed to vote");
      }
    } catch {
      toast.error("Failed to vote");
    }
  };

  return (
    <div className="space-y-4">
      {/* Comment Form - Only if canPost */}
      {effectiveCanPost ? (
        <form onSubmit={handleSubmit}>
          <textarea
            placeholder="Write a comment... (permanent, cannot be edited or deleted)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white placeholder:text-white/40 text-sm resize-none"
            rows={3}
            maxLength={2000}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-white/40">{text.length}/2000</span>
            <button
              type="submit"
              disabled={!text.trim() || text.length < 3 || submitting}
              className="px-4 py-2 rounded-xl bg-pink-500/80 hover:bg-pink-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium transition"
            >
              {submitting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </form>
      ) : null}

      {/* Comments List */}
      {loading ? (
        <div className="text-center text-white/50 py-8">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-center text-white/50 py-8">
          No comments yet.
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const voteDisabled = !effectiveCanVote || comment.voteLocked;

            return (
              <div
                key={comment.id}
                className="bg-black/20 rounded-xl p-3 md:p-4 border border-white/10"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-pink-300 text-sm">
                      {comment.authorWallet}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono">
                      #{comment.id.slice(-6)}
                    </span>
                  </div>
                  <span className="text-xs text-white/40">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p className="text-white/90 text-sm mb-3 whitespace-pre-wrap break-words">
                  {comment.body}
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleVote(comment.id, 1)}
                    disabled={voteDisabled}
                    title={
                      !effectiveCanVote
                        ? "Paid members can vote"
                        : comment.voteLocked
                        ? "Vote locked"
                        : comment.userVote
                        ? `You can change once within ${comment.secondsLeftToFlip ?? 0}s`
                        : "Vote"
                    }
                    className={`flex items-center gap-1 text-sm transition ${
                      comment.userVote === 1
                        ? "text-green-400"
                        : !voteDisabled
                        ? "text-white/50 hover:text-green-400"
                        : "text-white/30 cursor-not-allowed"
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
                    <span>{comment.memberLikes}</span>
                  </button>
                  <button
                    onClick={() => handleVote(comment.id, -1)}
                    disabled={voteDisabled}
                    title={
                      !effectiveCanVote
                        ? "Paid members can vote"
                        : comment.voteLocked
                        ? "Vote locked"
                        : comment.userVote
                        ? `You can change once within ${comment.secondsLeftToFlip ?? 0}s`
                        : "Vote"
                    }
                    className={`flex items-center gap-1 text-sm transition ${
                      comment.userVote === -1
                        ? "text-red-400"
                        : !voteDisabled
                        ? "text-white/50 hover:text-red-400"
                        : "text-white/30 cursor-not-allowed"
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
                    <span>{comment.memberDislikes}</span>
                  </button>
                </div>

                {/* Vote lock status hint */}
                {effectiveCanVote && comment.userVote !== null && (
                  <div className="mt-2 text-[11px] text-white/40">
                    {comment.voteLocked ? (
                      <span className="text-white/50">Vote locked.</span>
                    ) : (
                      <span>
                        You can change your vote once for the next{" "}
                        <span className="text-white">{comment.secondsLeftToFlip ?? 0}s</span>.
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
