"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

type Comment = {
  id: string;
  body: string;
  authorId: string;
  authorWallet: string;
  createdAt: string;
  status?: "ACTIVE" | "PENDING" | "HIDDEN" | "REMOVED";
  memberLikes: number;
  memberDislikes: number;
  userVote: number | null;
  voteLocked?: boolean;
  secondsLeftToFlip?: number;
  reportedByMe?: boolean;
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
  isAdminOrMod?: boolean;
}

type GradeState = {
  open: boolean;
  commentId: string | null;
  busy: boolean;
  error?: string;
};

type DeleteState = {
  open: boolean;
  commentId: string | null;
  busy: boolean;
};

type ReportState = {
  open: boolean;
  commentId: string | null;
  reason: string;
  note: string;
  busy: boolean;
  error?: string;
};

type MessageModalState = {
  open: boolean;
  recipientId: string | null;
  recipientDisplay: string | null;
  subject: string;
  body: string;
  sending: boolean;
};

export default function Comments({
  videoId,
  canPost,
  canVote,
  isAdminOrMod,
}: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [hasPostedComment, setHasPostedComment] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [grade, setGrade] = useState<GradeState>({
    open: false,
    commentId: null,
    busy: false,
  });

  const [deleteModal, setDeleteModal] = useState<DeleteState>({
    open: false,
    commentId: null,
    busy: false,
  });

  const [reportModal, setReportModal] = useState<ReportState>({
    open: false,
    commentId: null,
    reason: "SPAM",
    note: "",
    busy: false,
  });

  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const [messageModal, setMessageModal] = useState<MessageModalState>({
    open: false,
    recipientId: null,
    recipientDisplay: null,
    subject: "",
    body: "",
    sending: false,
  });

  // Use props directly - no auth fetch needed since server provides all permissions
  const effectiveCanPost = !!canPost;
  const effectiveCanVote = !!canVote;
  const canGrade = !!isAdminOrMod;

  useEffect(() => {
    setLoading(true);
    setComments([]);
    setHasPostedComment(false);
    setCurrentUserId(null);
    setSubmitting(false);
    setText("");
    setReportedIds(new Set());

    fetch(`/api/comments?videoId=${videoId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setComments(data.comments);
          if (Array.isArray(data.comments)) {
            const initial = new Set<string>();
            for (const c of data.comments) {
              if (c.reportedByMe) initial.add(c.id);
            }
            setReportedIds(initial);
          }

          if (data.hasUserComment) setHasPostedComment(true);

          if (data.currentUserId) setCurrentUserId(data.currentUserId);
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
        if (data.comment?.status && data.comment.status !== "ACTIVE") {
          toast.success("Comment submitted for review.");
        } else {
          setComments([data.comment, ...comments]);
        }
        setText("");
        setHasPostedComment(true);
        if (!data.comment?.status || data.comment.status === "ACTIVE") {
          toast.success("Comment posted!");
        }
        // Show credits earned toast and update UI
        if (data.creditsEarned && data.creditsEarned > 0) {
          toast.success(`You earned ${data.creditsEarned} Special Credits!`, {
            icon: <img src="/logos/diamond3.png" alt="" className="w-5 h-5" />,
          });
          // Dispatch event to update credit display in nav
          window.dispatchEvent(new CustomEvent("credits-changed"));
        }
      } else if (data.error === "ALREADY_COMMENTED") {
        setHasPostedComment(true);
        toast.error("Only 1 comment per Member per Video!");
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
        // Show credits earned toast and update UI
        if (data.creditsEarned && data.creditsEarned > 0) {
          toast.success(`You earned ${data.creditsEarned} Special Credit!`, {
            icon: <img src="/logos/diamond3.png" alt="" className="w-5 h-5" />,
          });
          // Dispatch event to update credit display in nav
          window.dispatchEvent(new CustomEvent("credits-changed"));
        }
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
      } else if (data.error === "CANNOT_VOTE_OWN_COMMENT") {
        toast.error("You can't rate your own comment");
      } else {
        toast.error(data.error || "Failed to vote");
      }
    } catch {
      toast.error("Failed to vote");
    }
  };

  const openGrade = (commentId: string) => {
    if (!canGrade) return;
    setGrade({ open: true, commentId, busy: false, error: undefined });
  };

  const closeGrade = () => {
    if (grade.busy) return;
    setGrade({ open: false, commentId: null, busy: false, error: undefined });
  };

  const submitGrade = async (direction: 1 | -1) => {
    if (!grade.open || !grade.commentId || grade.busy) return;

    setGrade({ ...grade, busy: true, error: undefined });

    try {
      const res = await fetch("/api/mod/videos/adjust-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCommentId: grade.commentId,
          direction,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        const err = data?.error || "FAILED";

        if (err === "ALREADY_SOURCED_BY_YOU") {
          toast.error("You already graded using this comment.");
        } else if (err === "ALREADY_SOURCED") {
          toast.error("That comment was already sourced for this video.");
        } else if (err === "UNAUTHORIZED") {
          toast.error("Please log in.");
        } else if (err === "FORBIDDEN") {
          toast.error("Admins/Mods only.");
        } else if (err === "COMMENT_NOT_FOUND") {
          toast.error("Comment not found (or not active).");
        } else if (err === "VIDEO_NOT_FOUND") {
          toast.error("Video not found.");
        } else if (err === "BAD_REQUEST") {
          toast.error("Bad request.");
        } else {
          toast.error(err);
        }

        setGrade({ ...grade, busy: false, error: err });
        return;
      }

      toast.success(`Graded! Video score is now ${data.adminScore}.`);
      setGrade({ open: false, commentId: null, busy: false, error: undefined });
    } catch {
      toast.error("Failed to grade");
      setGrade({ ...grade, busy: false, error: "NETWORK_ERROR" });
    }
  };

  const openDeleteModal = (commentId: string) => {
    if (!isAdminOrMod) return;
    setDeleteModal({ open: true, commentId, busy: false });
  };

  const closeDeleteModal = () => {
    if (deleteModal.busy) return;
    setDeleteModal({ open: false, commentId: null, busy: false });
  };

  const confirmDelete = async () => {
    if (!deleteModal.open || !deleteModal.commentId || deleteModal.busy) return;

    setDeleteModal({ ...deleteModal, busy: true });

    try {
      const res = await fetch("/api/mod/comments/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId: deleteModal.commentId,
          reason: "Removed by moderator",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "Failed to remove comment");
        setDeleteModal({ ...deleteModal, busy: false });
        return;
      }

      // Remove the comment from the local state
      setComments(comments.filter((c) => c.id !== deleteModal.commentId));
      toast.success("Comment removed");
      setDeleteModal({ open: false, commentId: null, busy: false });
    } catch {
      toast.error("Failed to remove comment");
      setDeleteModal({ ...deleteModal, busy: false });
    }
  };

  const openReportModal = (commentId: string) => {
    setReportModal({ open: true, commentId, reason: "SPAM", note: "", busy: false, error: undefined });
  };

  const closeReportModal = () => {
    if (reportModal.busy) return;
    setReportModal({ open: false, commentId: null, reason: "SPAM", note: "", busy: false, error: undefined });
  };

  const submitReport = async () => {
    if (!reportModal.open || !reportModal.commentId || reportModal.busy) return;

    setReportModal({ ...reportModal, busy: true, error: undefined });
    try {
      const res = await fetch("/api/comments/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId: reportModal.commentId,
          reason: reportModal.reason,
          note: reportModal.note,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setReportModal({ ...reportModal, busy: false, error: data?.error || "report_failed" });
        return;
      }

      setReportedIds((prev) => {
        const next = new Set(prev);
        next.add(reportModal.commentId!);
        return next;
      });

      toast.success(data.alreadyReported ? "Already reported" : "Report submitted");
      closeReportModal();
    } catch {
      setReportModal({ ...reportModal, busy: false, error: "network_error" });
    }
  };

  const openMessageModal = (authorId: string, authorWallet: string) => {
    console.log("[Comments] openMessageModal called", { authorId, authorWallet, currentUserId });

    if (!currentUserId) {
      toast.error("Please log in to send messages");
      return;
    }
    if (authorId === currentUserId) {
      toast.info("You can't message yourself");
      return;
    }
    if (!authorId) {
      toast.error("Unable to identify user");
      return;
    }

    console.log("[Comments] Opening message modal for", authorWallet);
    setMessageModal({
      open: true,
      recipientId: authorId,
      recipientDisplay: authorWallet,
      subject: "",
      body: "",
      sending: false,
    });
  };

  const closeMessageModal = () => {
    if (messageModal.sending) return;
    setMessageModal({
      open: false,
      recipientId: null,
      recipientDisplay: null,
      subject: "",
      body: "",
      sending: false,
    });
  };

  const sendMessage = async () => {
    if (!messageModal.recipientId || !messageModal.subject.trim() || !messageModal.body.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setMessageModal({ ...messageModal, sending: true });

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: messageModal.recipientId,
          subject: messageModal.subject.trim(),
          message: messageModal.body.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success("Message sent!");
        closeMessageModal();
      } else if (data.error === "USER_BLOCKED_YOU") {
        toast.error("This user has blocked you");
        setMessageModal({ ...messageModal, sending: false });
      } else if (data.error === "YOU_BLOCKED_USER") {
        toast.error("You have blocked this user");
        setMessageModal({ ...messageModal, sending: false });
      } else {
        toast.error(data.error || "Failed to send message");
        setMessageModal({ ...messageModal, sending: false });
      }
    } catch {
      toast.error("Failed to send message");
      setMessageModal({ ...messageModal, sending: false });
    }
  };

  return (
    <div className="space-y-4">
      {/* Commented badge for Diamond members who have commented */}
      {hasPostedComment && effectiveCanPost && (
        <div className="inline-flex items-center gap-2 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-2">
          <svg
            className="w-5 h-5 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-semibold text-green-400">Commented</span>
        </div>
      )}

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
            <div className="relative group">
              <button
                type="submit"
                disabled={!text.trim() || text.length < 3 || submitting || hasPostedComment}
                className="px-4 py-2 rounded-xl bg-pink-500/80 hover:bg-pink-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium transition"
              >
                {submitting ? "Posting..." : "Post Comment"}
              </button>
              {hasPostedComment && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/90 border border-white/20 rounded-lg text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Only 1 comment per Member per Video!
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
                </div>
              )}
            </div>
          </div>
        </form>
      ) : null}

      {/* Comments List */}
      {loading ? (
        <div className="text-center text-white/50 py-8">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-center text-white/50 py-8">No comments yet.</div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const isOwnComment = !!(currentUserId && comment.authorId === currentUserId);
            const voteDisabled = !effectiveCanVote || !!comment.voteLocked || isOwnComment;

            return (
              <div
                key={comment.id}
                className="bg-black/20 rounded-xl p-3 md:p-4 border border-white/10 relative"
              >
                {/* Admin/Mod delete button */}
                {isAdminOrMod && (
                  <button
                    type="button"
                    onClick={() => openDeleteModal(comment.id)}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition"
                    title="Remove comment"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2 pr-8">
                  <div className="flex items-center gap-2">
                    {isOwnComment ? (
                      <span className="font-medium text-pink-300 text-sm">{comment.authorWallet}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openMessageModal(comment.authorId, comment.authorWallet)}
                        className="inline-flex items-center gap-1.5 font-medium text-pink-300 text-sm hover:text-pink-200 transition cursor-pointer group"
                        title="Click to send message"
                      >
                        <span className="group-hover:underline">{comment.authorWallet}</span>
                        <svg
                          className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                    )}
                    <span className="text-[10px] text-white/30 font-mono">#{comment.id.slice(-6)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {comment.status && comment.status !== "ACTIVE" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-yellow-400/30 text-yellow-300">
                        {comment.status}
                      </span>
                    )}
                    <span className="text-xs text-white/40">{formatDate(comment.createdAt)}</span>
                    {!isOwnComment && (
                      <button
                        type="button"
                        onClick={() => openReportModal(comment.id)}
                        disabled={reportedIds.has(comment.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                          reportedIds.has(comment.id)
                            ? "border-white/10 text-white/30 cursor-not-allowed"
                            : "border-red-500/30 text-red-300 hover:border-red-400/60 hover:text-red-200"
                        }`}
                        title={reportedIds.has(comment.id) ? "Already reported" : "Report comment"}
                      >
                        {reportedIds.has(comment.id) ? "Reported" : "Report"}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-white/90 text-sm mb-3 whitespace-pre-wrap break-words">
                  {comment.body}
                </p>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleVote(comment.id, 1)}
                      disabled={voteDisabled}
                      title={
                        isOwnComment
                          ? "You can't rate your own comment"
                          : !effectiveCanVote
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
                        isOwnComment
                          ? "You can't rate your own comment"
                          : !effectiveCanVote
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

                  {/* Grade button (Admin/Mod only) */}
                  {canGrade && (
                    <button
                      type="button"
                      onClick={() => openGrade(comment.id)}
                      className="px-3 py-1.5 rounded-xl border border-yellow-400/30 bg-yellow-400/10 text-yellow-200 text-xs font-semibold hover:bg-yellow-400/15 transition"
                      title="Grade the VIDEO admin score using this comment as the source"
                    >
                      Grade
                    </button>
                  )}
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

      {/* Grade modal */}
      {grade.open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Grade Video</div>
                <div className="text-xs text-white/50 mt-0.5">
                  Adjust the video admin score by +1 or -1. This will award 1 MVM point
                  to the sourced comment&apos;s author (once per mod).
                </div>
              </div>
              <button
                type="button"
                onClick={closeGrade}
                disabled={grade.busy}
                className="text-white/60 hover:text-white disabled:opacity-40"
                title="Close"
              >
                ✕
              </button>
            </div>

            {grade.error && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                Error: {grade.error}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => submitGrade(1)}
                disabled={grade.busy}
                className="flex-1 px-4 py-2 rounded-xl bg-green-500/80 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
              >
                {grade.busy ? "Working..." : "Up (+1)"}
              </button>
              <button
                type="button"
                onClick={() => submitGrade(-1)}
                disabled={grade.busy}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500/70 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
              >
                {grade.busy ? "Working..." : "Down (-1)"}
              </button>
            </div>

            <button
              type="button"
              onClick={closeGrade}
              disabled={grade.busy}
              className="mt-3 w-full px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white text-sm font-medium transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Report confirmation modal */}
      {reportModal.open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-black/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-white font-semibold">Report Comment</div>
              <button
                type="button"
                onClick={closeReportModal}
                disabled={reportModal.busy}
                className="text-white/60 hover:text-white disabled:opacity-40"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <label className="block text-xs text-white/60">Reason</label>
              <select
                value={reportModal.reason}
                onChange={(e) => setReportModal({ ...reportModal, reason: e.target.value })}
                disabled={reportModal.busy}
                className="w-full rounded-lg bg-black/60 border border-white/10 text-white text-sm px-3 py-2"
              >
                <option value="SPAM">Spam</option>
                <option value="HARASSMENT">Harassment</option>
                <option value="HATE">Hate</option>
                <option value="THREAT">Threat</option>
                <option value="SEXUAL_VIOLENCE">Sexual Violence</option>
                <option value="OTHER">Other</option>
              </select>

              <label className="block text-xs text-white/60">Optional note</label>
              <textarea
                value={reportModal.note}
                onChange={(e) => setReportModal({ ...reportModal, note: e.target.value })}
                disabled={reportModal.busy}
                rows={3}
                className="w-full rounded-lg bg-black/60 border border-white/10 text-white text-sm px-3 py-2"
                placeholder="Add context (optional)"
              />
            </div>

            {reportModal.error && (
              <div className="mt-3 text-xs text-red-400">
                {reportModal.error}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeReportModal}
                disabled={reportModal.busy}
                className="flex-1 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                disabled={reportModal.busy}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
              >
                {reportModal.busy ? "Reporting..." : "Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-black/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-white font-semibold">Remove Comment</div>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteModal.busy}
                className="text-white/60 hover:text-white disabled:opacity-40"
                title="Close"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to remove this comment? This action cannot be undone.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteModal.busy}
                className="flex-1 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteModal.busy}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
              >
                {deleteModal.busy ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {messageModal.open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 px-4 py-6 overflow-y-auto overscroll-contain modal-scroll modal-safe min-h-[100svh] min-h-[100dvh]">
          <div className="w-full max-w-md rounded-2xl border border-pink-500/30 bg-black/90 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-white font-semibold">Send Message</div>
                <div className="text-xs text-white/50 mt-0.5">
                  To: {messageModal.recipientDisplay}
                </div>
              </div>
              <button
                type="button"
                onClick={closeMessageModal}
                disabled={messageModal.sending}
                className="text-white/60 hover:text-white disabled:opacity-40"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-white/60 mb-1">Subject</label>
                <input
                  type="text"
                  value={messageModal.subject}
                  onChange={(e) => setMessageModal({ ...messageModal, subject: e.target.value })}
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-pink-500/50 focus:outline-none text-sm"
                  placeholder="Subject..."
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Message</label>
                <textarea
                  value={messageModal.body}
                  onChange={(e) => setMessageModal({ ...messageModal, body: e.target.value })}
                  maxLength={2000}
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-pink-500/50 focus:outline-none resize-none text-sm"
                  placeholder="Write your message..."
                />
                <div className="text-right text-xs text-white/40 mt-1">
                  {messageModal.body.length}/2000
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeMessageModal}
                disabled={messageModal.sending}
                className="flex-1 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendMessage}
                disabled={messageModal.sending || !messageModal.subject.trim() || !messageModal.body.trim()}
                className="flex-1 px-4 py-2 rounded-xl bg-pink-500/80 hover:bg-pink-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
              >
                {messageModal.sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
