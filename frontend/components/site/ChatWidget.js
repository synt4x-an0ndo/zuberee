"use client";

import ChatUpdates from "@/components/site/ChatUpdates";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiClock, FiCpu, FiLock, FiLogIn, FiHeadphones, FiSend, FiUser, FiX, FiZap } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useSite } from "@/context/SiteContext";
import { api, imgUrl } from "@/lib/api";
import MarkdownText from "@/components/site/MarkdownText";
import TrbBadge from "@/components/site/TrbBadge";

/**
 * Floating store chat (bottom-right, on every storefront page).
 *
  * Two modes, chosen from the panel's start screen:
 *   1. Chat with Admin — PERSISTED in the database (POST
 *      /api/chat/admin-chat ...). The thread stays in the customer's
 *      chat box, so an admin reply sent later is waiting (with an
 *      unread badge on the chat button) when they come back. The admin
 *      replies from Admin -> Live chat.
 *   2. Chat with AI — stateless Gemini shopping assistant
 *      (POST /api/chat/ai). The last few messages ride along as history;
 *      nothing is stored server-side — AI chats are never logged.
 *      Product cards in the reply come from the server's live catalogue
 *      search.
 *
 * Both modes require a signed-in customer (store owner's choice):
 * guests are shown a sign-in prompt instead.
 */

function clock(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function taka(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `৳${n.toLocaleString("en-IN")}` : "";
}

function ProductCard({ product }) {
  const image = imgUrl(product.image);
  return (
    <Link href={product.url} className="chat-product">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" width={44} height={52} />
      ) : (
        <span className="chat-product-ph" aria-hidden="true" />
      )}
      <span className="chat-product-info">
        <span className="chat-product-name">{product.name}</span>
        <span className="chat-product-price">
          {taka(product.salePrice)}
          {product.salePrice < product.price && <s>{taka(product.price)}</s>}
        </span>
        {(product.sizes?.length > 0 || product.colors?.length > 0) && (
          <span className="chat-chip-row">
            {product.sizes?.map((s) => (
              <span key={`s-${s}`} className="chat-chip">{s}</span>
            ))}
            {product.colors?.map((c) => (
              <span key={`c-${c}`} className="chat-chip chat-chip-color">{c}</span>
            ))}
          </span>
        )}
      </span>
    </Link>
  );
}

export default function ChatWidget() {
    const { user } = useAuth();
  const { drawerOpen } = useCart();
  const { siteName } = useSite();
  const [open, setOpen] = useState(false);
  const [updatesDismissedFor, setUpdatesDismissedFor] = useState(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const closePanel = () => {
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 210);
  };
    useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  // Hide the chat button while the cart drawer is open (and close the
  // panel first if it was open, so the two never overlap).
  useEffect(() => {
    if (drawerOpen && open && !closing) closePanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, open]);
  const [view, setView] = useState("menu"); // menu | admin | ai

    // Admin chat is persisted per account (see POST /api/chat/admin-chat):
  // leaving and coming back resumes the same thread.

  // --- Chat with Admin state ---
  const [adminConvId, setAdminConvId] = useState(null);
  const [adminMessages, setAdminMessages] = useState([]);
  const [adminInput, setAdminInput] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminEnded, setAdminEnded] = useState(false);
    const [adminError, setAdminError] = useState("");
  const [adminUnread, setAdminUnread] = useState(0);
  const startingRef = useRef(false);

  // --- Chat with AI state ---
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const bodyRef = useRef(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [adminMessages, aiMessages, view, open]);

  // Start the admin conversation when the admin view opens.
  useEffect(() => {
    if (!open || view !== "admin" || !user || adminConvId || startingRef.current) return;
    startingRef.current = true;
    setAdminError("");
    api
            .post("api/chat/admin-chat", {})
      .then((res) => {
                setAdminConvId(res?.data?.conversationId || null);
        setAdminMessages(res?.data?.messages || []);
        setAdminEnded(res?.data?.status !== "open");
        setAdminUnread(0);
      })
      .catch((err) => setAdminError(err.message || "Could not start the chat."))
      .finally(() => {
        startingRef.current = false;
      });
  }, [open, view, user, adminConvId]);

  // Poll for admin replies.
  useEffect(() => {
    if (!open || view !== "admin" || !adminConvId) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
                const res = await api.get(`api/chat/admin-chat/${adminConvId}`);
        if (cancelled) return;
        setAdminMessages(res?.data?.messages || []);
        setAdminUnread(0);
        if (res?.data?.status && res.data.status !== "open") setAdminEnded(true);
      } catch (err) {
        if (cancelled) return;
                if (err.status === 404) {
          // Conversation no longer exists server-side.
          setAdminEnded(true);
          setAdminConvId(null);
        }
      }
    };
    const timer = setInterval(poll, 3500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open, view, adminConvId]);

    // Unread-reply badge: while signed in, periodically check for admin
  // replies so they surface on the chat button even while it is closed.
  useEffect(() => {
    if (!user) {
      setAdminUnread(0);
      return undefined;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const res = await api.get("api/chat/admin-chat");
        if (!cancelled) setAdminUnread(res?.data?.unread || 0);
      } catch {
        /* badge is best-effort */
      }
    };
    check();
    const timer = setInterval(check, 25000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, open]);

  const sendAdmin = async (e) => {
    e.preventDefault();
    const text = adminInput.trim();
    if (!text || !adminConvId || adminBusy) return;
    setAdminBusy(true);
    setAdminError("");
    try {
            const res = await api.post(`api/chat/admin-chat/${adminConvId}`, {
        body: text,
      });
      setAdminInput("");
      if (res?.data?.message) {
        setAdminMessages((prev) => [...prev, res.data.message]);
      }
    } catch (err) {
      setAdminError(err.message || "Message could not be sent.");
    } finally {
      setAdminBusy(false);
    }
  };

  const endAdminChat = async () => {
    if (adminConvId) {
      try {
                await api.delete(`api/chat/admin-chat/${adminConvId}`);
      } catch {
        /* already gone — same result for a memory-only chat */
      }
    }
        setAdminConvId(null);
    setAdminMessages([]);
    setAdminEnded(false);
    setAdminError("");
    setAdminUnread(0);
    setView("menu");
  };

  const startNewAdminChat = async () => {
    setAdminError("");
    try {
      const res = await api.post("api/chat/admin-chat", {});
      setAdminConvId(res?.data?.conversationId || null);
      setAdminMessages(res?.data?.messages || []);
      setAdminEnded(res?.data?.status !== "open");
      setAdminUnread(0);
    } catch (err) {
      setAdminError(err.message || "Could not start the chat.");
    }
  };

  const SUGGESTIONS = [
    "Show me what's on sale",
    "I need a bag under ৳2,000",
    "What sizes do you have?",
    "How can I track my order?",
  ];

  const sendAi = async (e, preset) => {
    e?.preventDefault();
    const text = (preset ?? aiInput).trim();
    if (!text || aiBusy) return;
    const next = [...aiMessages, { role: "user", text, createdAt: Date.now() }];
    setAiMessages(next);
    setAiInput("");
    setAiBusy(true);
    try {
      const res = await api.post("api/chat/ai", {
        message: text,
        history: next.slice(-8).map(({ role, text: t }) => ({ role, text: t })),
      });
      setAiMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: res?.data?.reply || "Sorry, I could not answer that just now.",
          products: res?.data?.products || [],
          createdAt: Date.now(),
        },
      ]);
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            err.status === 503
              ? "The AI assistant is not set up yet. Please use “Chat with Admin” above and we will help you there."
              : err.message || "The AI assistant is unavailable right now.",
          products: [],
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setAiBusy(false);
    }
  };

  const title =
    view === "admin" ? "Chat with Admin" : view === "ai" ? "Chat with AI" : `Chat with ${siteName || "us"}`;

  return (
    <>
      {open && (
        <>
          <div
            className={`chat-backdrop${closing ? " is-closing" : ""}`}
            onClick={closePanel}
            aria-hidden="true"
          />
          <div className={`chat-panel view-${view}${closing ? " is-closing" : ""}`} role="dialog" aria-label={title}>
                    <div className={`chat-head${view === "menu" ? " is-hero" : ""}`}>
            <div className="chat-head-row">
              {view !== "menu" ? (
                <>
                  <button type="button" className="chat-back" onClick={() => setView("menu")} aria-label="Back to chat options">
                    <FiChevronLeft aria-hidden="true" />
                  </button>
                  <span className="chat-head-avatar" aria-hidden="true">
                    {view === "admin" ? <FiUser /> : <FiCpu />}
                  </span>
                </>
              ) : (
                <span className="chat-head-avatar" aria-hidden="true">
                  <FiHeadphones />
                </span>
              )}
              <span className="chat-head-text">
                <strong>{title}</strong>
                <small>
                  {view === "admin"
                    ? "Store team · live, session only"
                    : view === "ai"
                      ? "Shopping assistant · replies instantly"
                      : "AI assistant & store team"}
                </small>
              </span>
              <span className="trb-slot"><TrbBadge /></span>
              <button type="button" className="chat-close" onClick={closePanel} aria-label="Close chat">
                <FiX aria-hidden="true" />
              </button>
            </div>
            {view === "menu" && (
              <div className="chat-hero">
                <strong>Hi {user?.name ? user.name.split(" ")[0] : "there"}.</strong>
                <span>How can we make your day easier?</span>
              </div>
            )}
          </div>

          {!user ? (
                        <div className="chat-signin">
              <span className="chat-signin-icon" aria-hidden="true">
                <FiLogIn />
              </span>
              <strong className="chat-signin-title">Sign in to start chatting</strong>
              <p>
                Both Admin chat and the AI assistant are for signed-in customers, so the {siteName || "store"} team
                can help you faster with your orders.
              </p>
              <Link href="/login" className="chat-signin-btn" onClick={closePanel}>
                Sign in
              </Link>
              <p className="chat-note">New here? You can create an account from the sign-in page.</p>
            </div>
          ) : view === "menu" ? (
                        <div className="chat-menu">
              <button type="button" className="chat-choice" onClick={() => setView("admin")}>
                <span className="chat-choice-icon" aria-hidden="true">
                  <FiUser />
                </span>
                <span className="chat-choice-main">
                  <strong>Chat with Admin</strong>
                  <small>Personal help with orders & delivery.</small>
                                    <span className="chat-choice-badge">
                    <FiClock aria-hidden="true" /> Store team
                  </span>
                  {adminUnread > 0 && (
                    <span className="chat-choice-unread">
                      {adminUnread} new {adminUnread === 1 ? "reply" : "replies"}
                    </span>
                  )}
                </span>
                <span className="chat-choice-arrow" aria-hidden="true">
                  <FiChevronRight />
                </span>
              </button>
              <button type="button" className="chat-choice chat-choice-ai" onClick={() => setView("ai")}>
                <span className="chat-choice-icon" aria-hidden="true">
                  <FiCpu />
                </span>
                <span className="chat-choice-main">
                  <strong>Chat with AI</strong>
                  <small>Find your next favourite, instantly.</small>
                  <span className="chat-choice-badge">
                    <FiZap aria-hidden="true" /> Instant answers
                  </span>
                </span>
                <span className="chat-choice-arrow" aria-hidden="true">
                  <FiChevronRight />
                </span>
              </button>
              <div className="chat-quick">
                <span className="chat-quick-label">A quick start</span>
                <div className="chat-quick-list">
                  {SUGGESTIONS.map((s, index) => (
                    <button
                      key={s}
                      type="button"
                      className="chat-quick-chip"
                      title={s}
                      onClick={() => {
                        setView("ai");
                        sendAi(null, s);
                      }}
                    >
                      {["Offers & sales", "Bags under ৳2,000", "Available sizes", "Track my order"][index]}
                    </button>
                  ))}
                </div>
              </div>
              <p className="chat-privacy">
                <FiLock aria-hidden="true" />
                <span>Team chats stay for 7 days. AI chats aren&apos;t saved.</span>
              </p>
            </div>
          ) : view === "admin" ? (
            <>
              <div className="chat-body" ref={bodyRef}>

                {adminError && <p className="chat-error">{adminError}</p>}
                                {adminMessages.length === 0 && !adminError && (
                  <div className="chat-empty">
                    <span className="chat-empty-icon" aria-hidden="true">
                      <FiUser />
                    </span>
                    <strong>{adminConvId ? "You\u2019re connected" : "Connecting\u2026"}</strong>
                    <span>
                      {adminConvId
                        ? "Say hello — the store team will reply right here. This chat is saved to your account, so you can leave and pick it up any time."
                        : "Starting your live chat with the store team."}
                    </span>
                  </div>
                )}
                {adminMessages.map((m) =>
                  m.sender === "visitor" ? (
                    <div key={m.id} className="chat-msg is-mine">
                      {m.body}
                      <span className="chat-time">{clock(m.createdAt)}</span>
                    </div>
                  ) : (
                    <div key={m.id} className="chat-row">
                      <span className="chat-avatar" aria-hidden="true">
                        <FiUser />
                      </span>
                      <div className="chat-msg is-theirs">
                        {m.body}
                        <span className="chat-time">{clock(m.createdAt)}</span>
                      </div>
                    </div>
                  )
                )}
                {adminEnded && (
                  <p className="chat-note">This chat has ended. Start again any time from the chat menu.</p>
                )}
              </div>
              {!adminEnded ? (
                <form className="chat-input-row" onSubmit={sendAdmin}>
                  <input
                    value={adminInput}
                    onChange={(e) => setAdminInput(e.target.value)}
                    placeholder="Write a message…"
                    aria-label="Message to admin"
                    maxLength={2000}
                  />
                  <button type="submit" disabled={adminBusy || !adminConvId} aria-label="Send message">
                    <FiSend aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <div className="chat-input-row">
                                    <button type="button" className="chat-wide-btn" onClick={startNewAdminChat}>
                    Start a new chat
                  </button>
                </div>
              )}
              {adminConvId && !adminEnded && (
                <button type="button" className="chat-end" onClick={endAdminChat}>
                  End chat
                </button>
              )}
            </>
          ) : (
            <>
              <div className="chat-body" ref={bodyRef}>

                {aiMessages.length === 0 && (
                                    <div className="chat-suggest-wrap">
                    <div className="chat-empty chat-empty-top">
                      <span className="chat-empty-icon" aria-hidden="true">
                        <FiCpu />
                      </span>
                      <strong>How can I help?</strong>
                      <span>Ask about products by size, colour or price, delivery, orders…</span>
                    </div>
                    <span className="chat-quick-label">Try asking</span>
                    <div className="chat-suggests">
                      {SUGGESTIONS.map((s, index) => (
                        <button key={s} type="button" className="chat-suggest" onClick={() => sendAi(null, s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {aiMessages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="chat-msg is-mine">
                      {m.text}
                      <span className="chat-time">{clock(m.createdAt)}</span>
                    </div>
                  ) : (
                    <div key={i} className="chat-row">
                      <span className="chat-avatar" aria-hidden="true">
                        <FiCpu />
                      </span>
                      <div className="chat-msg is-theirs">
                        <MarkdownText text={m.text} />
                        {m.products?.length > 0 && (
                          <span className="chat-products">
                            {m.products.map((prod) => (
                              <ProductCard key={prod.id} product={prod} />
                            ))}
                          </span>
                        )}
                        <span className="chat-time">{clock(m.createdAt)}</span>
                      </div>
                    </div>
                  )
                )}
                {aiBusy && (
                  <div className="chat-row">
                    <span className="chat-avatar" aria-hidden="true">
                      <FiCpu />
                    </span>
                    <div className="chat-msg is-theirs chat-dots" aria-label="Assistant is typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </div>
              <form className="chat-input-row" onSubmit={sendAi}>
                <input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ask about products…"
                  aria-label="Message to AI assistant"
                  maxLength={1000}
                />
                <button type="submit" disabled={aiBusy} aria-label="Send message">
                  <FiSend aria-hidden="true" />
                </button>
              </form>
              {aiMessages.length > 0 && (
                <button
                  type="button"
                  className="chat-end"
                  onClick={() => setAiMessages([])}
                >
                  Clear conversation
                </button>
              )}
            </>
          )}
          </div>
        </>
      )}

            {!drawerOpen && (
      <div className="chat-launcher-anchor">
        {!open && !closing && user && updatesDismissedFor !== user.id && (
          <ChatUpdates key={`${user.id}:${(user.permissions || []).join(",")}`} user={user}
            enabled={!open && !closing && !drawerOpen} paused={false} aiMessages={aiMessages}
            onDismiss={() => setUpdatesDismissedFor(user.id)} />
        )}
      <button
        type="button"
        className={`chat-fab${open ? " is-open" : ""}`}
        onClick={() => (open ? closePanel() : setOpen(true))}
        aria-label={open ? "Close chat" : "Open AI assistant and admin chat"}
        aria-expanded={open}
      >
                        {!open && <span className="chat-fab-ring" aria-hidden="true" />}
        {!open && <span className="chat-fab-label">Chat with us</span>}
        {!open && <span className="chat-support-indicator" aria-hidden="true" />}
        {!open && adminUnread > 0 && <span className="chat-fab-badge">{adminUnread}</span>}
                {open ? <FiX aria-hidden="true" /> : (
          <svg className="chat-support-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
            <rect x="3" y="11" width="4" height="7" rx="2" />
            <rect x="17" y="11" width="4" height="7" rx="2" />
            <path d="M19 18v.5a3 3 0 0 1-3 3h-3" />
            <rect x="10" y="20" width="4" height="2" rx="1" fill="currentColor" stroke="none" />
          </svg>
        )}
      </button>
      </div>
      )}
    </>
  );
}
