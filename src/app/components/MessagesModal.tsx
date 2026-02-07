"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface Message {
  id: string;
  type: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
  senderId: string | null;
  sender: {
    id: string;
    display: string;
    role: string;
  } | null;
  // Raffle win info
  winnerId: string | null;
  canClaim: boolean;
  // Avatar prompt info
  isAvatarPrompt: boolean;
  showAvatarUpload: boolean;
}

interface MessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  initialRecipient?: { id: string; display: string } | null;
}

type ConfirmModalState = {
  type: "delete" | "delete-all" | "block" | null;
  messageId?: string;
  userId?: string;
  userDisplay?: string;
};

export default function MessagesModal({ isOpen, onClose, onUnreadCountChange, initialRecipient }: MessagesModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState<{ id: string; display: string } | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({ type: null });
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Claim prize state
  const [claiming, setClaiming] = useState(false);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      // If initial recipient provided, open compose
      if (initialRecipient) {
        setComposeRecipient(initialRecipient);
        setShowCompose(true);
        setComposeSubject("");
        setComposeBody("");
      }
    } else {
      // Reset state when closed
      setSelectedMessage(null);
      setShowCompose(false);
      setComposeRecipient(null);
      setComposeSubject("");
      setComposeBody("");
    }
  }, [isOpen, initialRecipient]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      fetchMessages({ silent: true });
    }, 20000);
    return () => clearInterval(interval);
  }, [isOpen]);

  async function fetchMessages(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/messages");
      const data = await res.json();
      if (data.ok) {
        setMessages(data.messages);
        const unreadCount = data.messages.filter((m: Message) => !m.read).length;
        onUnreadCountChange?.(unreadCount);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  async function markAsRead(messageId: string) {
    try {
      await fetch("/api/messages/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, read: true } : m))
      );
      const newUnreadCount = messages.filter((m) => !m.read && m.id !== messageId).length;
      onUnreadCountChange?.(newUnreadCount);
    } catch (err) {
      console.error("Failed to mark message as read:", err);
    }
  }

  async function markAllAsRead() {
    try {
      await fetch("/api/messages/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
      onUnreadCountChange?.(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }

  function selectMessage(msg: Message) {
    setSelectedMessage(msg);
    if (!msg.read) {
      markAsRead(msg.id);
    }
  }

  async function handleSendMessage() {
    if (!composeRecipient || !composeSubject.trim() || !composeBody.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: composeRecipient.id,
          subject: composeSubject.trim(),
          message: composeBody.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success("Message sent!");
        setShowCompose(false);
        setComposeRecipient(null);
        setComposeSubject("");
        setComposeBody("");
      } else if (data.error === "USER_BLOCKED_YOU") {
        toast.error("This user has blocked you");
      } else if (data.error === "YOU_BLOCKED_USER") {
        toast.error("You have blocked this user. Unblock them first to send a message.");
      } else {
        toast.error(data.error || "Failed to send message");
      }
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleReply(msg: Message) {
    if (!msg.sender) {
      toast.error("Cannot reply to system messages");
      return;
    }
    setComposeRecipient({ id: msg.sender.id, display: msg.sender.display });
    setComposeSubject(msg.subject.startsWith("Re: ") ? msg.subject : `Re: ${msg.subject}`);
    setComposeBody("");
    setSelectedMessage(null);
    setShowCompose(true);
  }

  async function handleDeleteConfirm() {
    if (!confirmModal.messageId) return;

    setConfirmBusy(true);
    try {
      const res = await fetch("/api/messages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: confirmModal.messageId }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success("Message deleted");
        setMessages((prev) => prev.filter((m) => m.id !== confirmModal.messageId));
        if (selectedMessage?.id === confirmModal.messageId) {
          setSelectedMessage(null);
        }
        setConfirmModal({ type: null });
      } else {
        toast.error(data.error || "Failed to delete message");
      }
    } catch {
      toast.error("Failed to delete message");
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleDeleteAllConfirm() {
    setConfirmBusy(true);
    try {
      const res = await fetch("/api/messages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(`Deleted ${data.deleted} message(s)`);
        setMessages([]);
        setSelectedMessage(null);
        onUnreadCountChange?.(0);
        setConfirmModal({ type: null });
      } else {
        toast.error(data.error || "Failed to delete messages");
      }
    } catch {
      toast.error("Failed to delete messages");
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleBlockConfirm() {
    if (!confirmModal.userId) return;

    setConfirmBusy(true);
    try {
      const res = await fetch("/api/messages/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: confirmModal.userId }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(`User blocked. They can no longer message you.`);
        setConfirmModal({ type: null });
      } else {
        toast.error(data.error || "Failed to block user");
      }
    } catch {
      toast.error("Failed to block user");
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleClaimPrize(winnerId: string) {
    setClaiming(true);
    try {
      const res = await fetch("/api/rewards-drawing/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success("Prize claimed! Credits have been added to your account.");
        // Update local state to hide claim button
        setMessages((prev) =>
          prev.map((m) => (m.winnerId === winnerId ? { ...m, canClaim: false } : m))
        );
        if (selectedMessage?.winnerId === winnerId) {
          setSelectedMessage({ ...selectedMessage, canClaim: false });
        }
      } else {
        toast.error(data.error || "Failed to claim prize");
      }
    } catch {
      toast.error("Failed to claim prize");
    } finally {
      setClaiming(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, or WebP image");
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      // Step 1: Get upload URL
      const uploadRes = await fetch("/api/profile/avatar/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.ok) {
        throw new Error(uploadData.error || "Failed to get upload URL");
      }

      // Step 2: Upload to R2
      await fetch(uploadData.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // Step 3: Confirm upload
      const confirmRes = await fetch("/api/profile/avatar/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: uploadData.key }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmData.ok) {
        throw new Error(confirmData.error || "Failed to confirm upload");
      }

      // Success! Update local state to hide upload button
      setAvatarPreview(confirmData.avatarUrl);
      setMessages((prev) =>
        prev.map((m) => (m.isAvatarPrompt ? { ...m, showAvatarUpload: false } : m))
      );
      if (selectedMessage?.isAvatarPrompt) {
        setSelectedMessage({ ...selectedMessage, showAvatarUpload: false });
      }

      toast.success("Avatar uploaded successfully!");

      // Dispatch event so other components can update
      window.dispatchEvent(new CustomEvent("auth-changed"));
    } catch (err) {
      console.error("Avatar upload failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      // Clear the input so the same file can be selected again
      e.target.value = "";
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case "WARNING":
        return { label: "Warning", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
      case "DIRECT":
        return { label: "Direct", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
      case "MASS":
        return { label: "Announcement", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
      case "SYSTEM":
        return { label: "System", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" };
      default:
        return { label: type, color: "bg-gray-500/20 text-gray-300 border-gray-500/30" };
    }
  }

  if (!isOpen) return null;

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-gradient-to-br from-gray-900 to-black border border-pink-500/30 rounded-2xl shadow-[0_0_30px_rgba(236,72,153,0.3)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src="/logos/textlogo/siteset3/messages100.png"
              alt="Messages"
              className="h-[35px]"
            />
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-pink-500 text-white rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setConfirmModal({ type: "delete-all" })}
                className="text-sm text-red-400 hover:text-red-300 transition"
              >
                Delete all
              </button>
            )}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-pink-400 hover:text-pink-300 transition"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition text-white/60 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-white/50">
              Loading messages...
            </div>
          ) : showCompose ? (
            /* Compose View */
            <div className="flex-1 flex flex-col p-4 overflow-y-auto">
              <button
                onClick={() => {
                  setShowCompose(false);
                  setComposeRecipient(null);
                }}
                className="flex items-center gap-1 text-sm text-pink-400 hover:text-pink-300 mb-4 self-start"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to messages
              </button>

              <h3 className="text-lg font-semibold text-white mb-4">
                {composeRecipient ? `Message to ${composeRecipient.display}` : "New Message"}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Subject</label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    maxLength={200}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-pink-500/50 focus:outline-none"
                    placeholder="Subject..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Message</label>
                  <textarea
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    maxLength={2000}
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-pink-500/50 focus:outline-none resize-none"
                    placeholder="Write your message..."
                  />
                  <div className="text-right text-xs text-white/40 mt-1">
                    {composeBody.length}/2000
                  </div>
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !composeSubject.trim() || !composeBody.trim()}
                  className="w-full px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium transition"
                >
                  {sending ? "Sending..." : "Send Message"}
                </button>
              </div>
            </div>
          ) : selectedMessage ? (
            /* Message Detail View */
            <div className="flex-1 flex flex-col p-4 overflow-y-auto">
              <button
                onClick={() => setSelectedMessage(null)}
                className="flex items-center gap-1 text-sm text-pink-400 hover:text-pink-300 mb-4 self-start"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to messages
              </button>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">{selectedMessage.subject}</h3>
                  <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded border ${getTypeLabel(selectedMessage.type).color}`}>
                    {getTypeLabel(selectedMessage.type).label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-white/50">
                  {selectedMessage.sender && (
                    <>
                      <span>From: {selectedMessage.sender.display}</span>
                      <span>•</span>
                    </>
                  )}
                  <span>{formatDate(selectedMessage.createdAt)}</span>
                </div>

                <div className="mt-4 p-4 bg-white/5 rounded-lg text-white/90 whitespace-pre-wrap">
                  {selectedMessage.body}
                </div>

                {/* Claim Prize Button - show prominently if canClaim */}
                {selectedMessage.canClaim && selectedMessage.winnerId && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-green-400 font-semibold">Prize Ready to Claim!</div>
                        <div className="text-white/60 text-sm">Click to add credits to your account</div>
                      </div>
                      <button
                        onClick={() => handleClaimPrize(selectedMessage.winnerId!)}
                        disabled={claiming}
                        className="px-6 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold transition shadow-lg shadow-green-500/25"
                      >
                        {claiming ? "Claiming..." : "Claim Prize"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Avatar Upload - show if this is an avatar prompt and user still needs one */}
                {selectedMessage.isAvatarPrompt && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-lg">
                    {selectedMessage.showAvatarUpload && !avatarPreview ? (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-pink-400 font-semibold">Add Your Avatar</div>
                          <div className="text-white/60 text-sm">JPEG, PNG, or WebP (max 2MB)</div>
                        </div>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleAvatarUpload}
                            disabled={uploadingAvatar}
                            className="hidden"
                          />
                          <span className={`inline-block px-6 py-2 rounded-lg font-bold transition shadow-lg ${
                            uploadingAvatar
                              ? "bg-gray-600 cursor-not-allowed"
                              : "bg-pink-500 hover:bg-pink-600 shadow-pink-500/25 cursor-pointer"
                          } text-white`}>
                            {uploadingAvatar ? "Uploading..." : "Choose Image"}
                          </span>
                        </label>
                      </div>
                    ) : avatarPreview ? (
                      <div className="flex items-center gap-4">
                        <img
                          src={avatarPreview}
                          alt="Your new avatar"
                          className="w-16 h-16 rounded-full object-cover border-2 border-pink-500/50"
                        />
                        <div>
                          <div className="text-green-400 font-semibold">Avatar Set!</div>
                          <div className="text-white/60 text-sm">Your profile picture is now visible on your comments.</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 flex items-center justify-center border-2 border-green-500/50">
                          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-green-400 font-semibold">Avatar Already Set!</div>
                          <div className="text-white/60 text-sm">You can change it anytime from your Profile page.</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                  {/* Reply button - show for messages with a sender, but disabled for MASS messages */}
                  {selectedMessage.sender && (
                    <button
                      onClick={() => selectedMessage.type !== "MASS" && handleReply(selectedMessage)}
                      disabled={selectedMessage.type === "MASS"}
                      title={selectedMessage.type === "MASS" ? "Cannot reply to announcements" : "Reply to this message"}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                        selectedMessage.type === "MASS"
                          ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                          : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Reply
                    </button>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => setConfirmModal({ type: "delete", messageId: selectedMessage.id })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>

                  {/* Block button - only for messages from other users, disabled for ADMIN */}
                  {selectedMessage.sender && (
                    <button
                      onClick={() =>
                        selectedMessage.sender?.role !== "ADMIN" &&
                        setConfirmModal({
                          type: "block",
                          userId: selectedMessage.sender!.id,
                          userDisplay: selectedMessage.sender!.display,
                        })
                      }
                      disabled={selectedMessage.sender?.role === "ADMIN"}
                      title={selectedMessage.sender?.role === "ADMIN" ? "Cannot block admin messages" : "Block this user"}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                        selectedMessage.sender?.role === "ADMIN"
                          ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                          : "bg-orange-500/20 hover:bg-orange-500/30 text-orange-300"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Block User
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-white/50">
              No messages yet
            </div>
          ) : (
            /* Message List View */
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {messages.map((msg) => {
                const typeInfo = getTypeLabel(msg.type);
                return (
                  <button
                    key={msg.id}
                    onClick={() => selectMessage(msg)}
                    className={`w-full text-left p-4 hover:bg-white/5 transition ${
                      !msg.read ? "bg-pink-500/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="shrink-0 mt-1.5">
                        {!msg.read ? (
                          <div className="w-2 h-2 rounded-full bg-pink-500" />
                        ) : (
                          <div className="w-2 h-2" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded border ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                          <span className="text-xs text-white/40">{formatDate(msg.createdAt)}</span>
                        </div>
                        <h4 className={`font-medium truncate ${!msg.read ? "text-white" : "text-white/80"}`}>
                          {msg.subject}
                        </h4>
                        <p className="text-sm text-white/50 truncate mt-0.5">{msg.body}</p>
                        {msg.sender && (
                          <p className="text-xs text-white/30 mt-1">From: {msg.sender.display}</p>
                        )}
                      </div>

                      <svg className="shrink-0 w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.type && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !confirmBusy && setConfirmModal({ type: null })} />
          <div className="relative w-full max-w-sm bg-gray-900 border border-white/10 rounded-xl p-5">
            {confirmModal.type === "delete-all" ? (
              <>
                <h3 className="text-lg font-semibold text-white mb-2">Delete All Messages?</h3>
                <p className="text-white/60 text-sm mb-4">
                  This will permanently delete all {messages.length} message(s) from your inbox. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmModal({ type: null })}
                    disabled={confirmBusy}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAllConfirm}
                    disabled={confirmBusy}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition disabled:opacity-50"
                  >
                    {confirmBusy ? "Deleting..." : "Delete All"}
                  </button>
                </div>
              </>
            ) : confirmModal.type === "delete" ? (
              <>
                <h3 className="text-lg font-semibold text-white mb-2">Delete Message?</h3>
                <p className="text-white/60 text-sm mb-4">
                  This will permanently remove this message from your inbox. This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmModal({ type: null })}
                    disabled={confirmBusy}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={confirmBusy}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition disabled:opacity-50"
                  >
                    {confirmBusy ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white mb-2">Block User?</h3>
                <p className="text-white/60 text-sm mb-4">
                  Block <span className="text-white font-medium">{confirmModal.userDisplay}</span>? They will no longer be able to send you messages.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmModal({ type: null })}
                    disabled={confirmBusy}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBlockConfirm}
                    disabled={confirmBusy}
                    className="flex-1 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition disabled:opacity-50"
                  >
                    {confirmBusy ? "Blocking..." : "Block User"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
