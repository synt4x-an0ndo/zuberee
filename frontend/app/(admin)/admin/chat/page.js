"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiMessageCircle, FiSend, FiTrash2 } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Badge, Button, Card, EmptyState, Input, cx } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";

/**
  * Live chat inbox ("chat with admin" from the storefront widget).
 *
 * Chats are PERSISTED in the database: every conversation is kept, so the
 * admin can reply at any time and the customer finds the reply (with an
 * unread badge) in their chat box when they return. Ending a chat keeps
 * the history; replying to an ended chat reopens it. The list polls
 * every 5s, the open conversation every 3s.
 *
 *   GET    /api/admin/chat/conversations          list (ADMIN)
 *   GET    /api/admin/chat/conversations/:id      messages, marks read
 *   POST   /api/admin/chat/conversations/:id      reply  { body }
 *   DELETE /api/admin/chat/conversations/:id      end chat for both sides
 */

function timeOf(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function AdminChatPage() {
  const { toast } = useFeedback();
  const [conversations, setConversations] = useState([]);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const res = await api.get("api/admin/chat/conversations");
      setConversations(Array.isArray(res?.data) ? res.data : []);
      setListError("");
    } catch (err) {
      setListError(err.message || "Could not load chats.");
    }
  }, []);

  useEffect(() => {
    loadList();
    const timer = setInterval(loadList, 5000);
    return () => clearInterval(timer);
  }, [loadList]);

  // Poll the open conversation; a 404 means it ended/expired (memory-only).
  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get(`api/admin/chat/conversations/${selectedId}`);
        if (!cancelled) setThread(res?.data || null);
      } catch (err) {
        if (!cancelled && err.status === 404) {
          setSelectedId(null);
          setThread(null);
          loadList();
        }
      }
    };
    load();
    const timer = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedId, loadList]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread]);

  const send = async (e) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    try {
      await api.post(`api/admin/chat/conversations/${selectedId}`, { body: text });
      setReply("");
      const res = await api.get(`api/admin/chat/conversations/${selectedId}`);
      setThread(res?.data || null);
      loadList();
    } catch (err) {
      toast.error(err.message || "Reply could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const endChat = async () => {
    if (!selectedId) return;
    try {
      await api.delete(`api/admin/chat/conversations/${selectedId}`);
      toast.success("Chat ended.");
    } catch {
      /* already gone — same outcome for a memory-only chat */
    }
    setSelectedId(null);
    setThread(null);
    loadList();
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Sales"
        title="Live chat"
        subtitle="Customer chats from the storefront widget. Chats are saved — reply any time, and the customer will find your reply when they come back. Conversations are automatically deleted 7 days after they start."
      />

      {listError && <p className="notice notice-danger" role="alert">{listError}</p>}

      <div className="admin-chat-layout">
        <Card>
          <div className="stack" style={{ gap: 6 }}>
            <strong style={{ padding: "2px 2px 6px" }}>
              Conversations {conversations.length > 0 && `(${conversations.length})`}
            </strong>
            {conversations.length === 0 ? (
              <EmptyState
                icon={FiMessageCircle}
                title="No chats yet"
                text="When a signed-in customer picks “Chat with Admin” on the store, their chat will appear here within a few seconds — and stay, so you can reply whenever you are ready."
              />
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cx("chat-admin-row", selectedId === c.id && "is-active")}
                  style={{
                    textAlign: "left",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: selectedId === c.id ? "var(--brand-tint)" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.userName}
                    </strong>
                                        {c.unread > 0 && <Badge tone="brand">{c.unread} new</Badge>}
                    {c.status !== "open" && (
                      <span className="muted" style={{ fontSize: "0.75rem" }}>Ended</span>
                    )}
                  </span>
                  <span className="muted" style={{ display: "block", fontSize: "0.8rem", marginTop: 2 }}>
                    {c.userEmail}
                  </span>
                  {c.lastMessage && (
                    <span
                      className="muted"
                      style={{
                        display: "block",
                        fontSize: "0.84rem",
                        marginTop: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.lastMessage.sender === "admin" ? "You: " : ""}
                      {c.lastMessage.body} · {timeOf(c.lastMessage.createdAt)}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </Card>

        <Card>
          {!selectedId || !thread ? (
            <EmptyState
              icon={FiMessageCircle}
              title="Pick a chat"
              text="Select an active conversation on the left to read and reply. New messages appear automatically every few seconds."
            />
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <strong>{thread.userName}</strong>
                  <span className="muted" style={{ display: "block", fontSize: "0.84rem" }}>
                                        {thread.userEmail} · started {timeOf(thread.createdAt)}
                    {thread.status !== "open" ? " · ended" : ""}
                  </span>
                </div>
                                {thread.status === "open" && (
                  <Button type="button" variant="ghost" size="sm" onClick={endChat}>
                    <FiTrash2 aria-hidden="true" /> End chat
                  </Button>
                )}
              </div>

              <div
                ref={bodyRef}
                style={{
                  height: 380,
                  overflowY: "auto",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  background: "var(--brand-tint)",
                }}
              >
                {thread.messages.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Connected — waiting for the customer&apos;s first message.
                  </p>
                ) : (
                  thread.messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: m.sender === "admin" ? "flex-end" : "flex-start",
                        maxWidth: "78%",
                        padding: "9px 12px",
                        borderRadius: 14,
                        background: m.sender === "admin" ? "var(--brand)" : "#fff",
                        color: m.sender === "admin" ? "var(--brand-contrast)" : "inherit",
                        border: m.sender === "admin" ? "none" : "1px solid var(--line)",
                        lineHeight: 1.45,
                        wordBreak: "break-word",
                      }}
                    >
                      {m.body}
                      <span style={{ display: "block", fontSize: "0.7rem", opacity: 0.7, marginTop: 3 }}>
                        {m.sender === "admin" ? "You" : thread.userName} · {timeOf(m.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>

                            {thread.status !== "open" && (
                <p className="notice" role="note" style={{ margin: 0 }}>
                  This chat has ended. Sending a reply will reopen it, and the customer will see your message with an unread badge.
                </p>
              )}

              <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a reply…"
                  aria-label="Reply to customer"
                  maxLength={2000}
                  style={{ flex: 1 }}
                />
                <Button type="submit" variant="primary" loading={sending} disabled={sending}>
                  <FiSend aria-hidden="true" /> Send
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
