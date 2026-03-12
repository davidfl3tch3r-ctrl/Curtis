"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Manager = { userId: string; teamName: string; username: string };
type Message = { id: string; sender_id: string; receiver_id: string; body: string; created_at: string };

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
        " " +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function MessagesPage() {
  const params = useParams();
  const leagueId = params.id as string;

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selected, setSelected] = useState<Manager | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectedRef = useRef<Manager | null>(null);
  selectedRef.current = selected;

  const navLinks = [
    { label: "Leagues",  href: "/" },
    { label: "Draft",    href: `/leagues/${leagueId}/draft` },
    { label: "Live",     href: `/leagues/${leagueId}/live` },
    { label: "Table",    href: `/leagues/${leagueId}/table` },
    { label: "Waivers",  href: `/leagues/${leagueId}/waivers` },
    { label: "Trades",   href: `/leagues/${leagueId}/trades` },
    { label: "Chat",     href: `/leagues/${leagueId}/chat` },
    { label: "Messages", href: `/leagues/${leagueId}/messages` },
  ];

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      setMyUserId(user.id);

      const [{ data: league }, { data: teams }] = await Promise.all([
        supabase.from("leagues").select("name").eq("id", leagueId).single(),
        supabase.from("teams").select("user_id, name").eq("league_id", leagueId).neq("user_id", user.id),
      ]);

      if (!mounted) return;
      if (league) setLeagueName(league.name);

      if (teams?.length) {
        const userIds = teams.map((t) => t.user_id).filter(Boolean);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);

        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));
        const mgrs: Manager[] = teams
          .filter((t) => t.user_id)
          .map((t) => ({
            userId: t.user_id,
            teamName: t.name,
            username: profileMap.get(t.user_id) ?? t.name,
          }));
        setManagers(mgrs);
      }
      setLoading(false);
    }

    init();

    // Realtime: listen for incoming DMs
    const supabaseClient = supabase;
    const channel = supabaseClient
      .channel(`dms-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `league_id=eq.${leagueId}` },
        (payload) => {
          const row = payload.new as Message & { type: string };
          if (row.type !== "dm") return;

          const currentSelected = selectedRef.current;
          const isInCurrentThread =
            currentSelected &&
            ((row.sender_id === currentSelected.userId) ||
             (row.receiver_id === currentSelected.userId));

          if (isInCurrentThread) {
            setThread((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, row];
            });
          } else {
            // Mark as unread from this sender
            setUnread((prev) => new Set([...prev, row.sender_id]));
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabaseClient.removeChannel(channel);
    };
  }, [leagueId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  async function selectManager(mgr: Manager) {
    setSelected(mgr);
    setUnread((prev) => { const next = new Set(prev); next.delete(mgr.userId); return next; });
    setThreadLoading(true);
    setThread([]);

    const supabase = createClient();
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, body, created_at")
      .eq("league_id", leagueId)
      .eq("type", "dm")
      .or(
        `and(sender_id.eq.${(await supabase.auth.getUser()).data.user?.id},receiver_id.eq.${mgr.userId}),` +
        `and(sender_id.eq.${mgr.userId},receiver_id.eq.${(await supabase.auth.getUser()).data.user?.id})`
      )
      .order("created_at", { ascending: true })
      .limit(200);

    setThread((msgs ?? []) as Message[]);
    setThreadLoading(false);
    inputRef.current?.focus();
  }

  async function send() {
    const body = input.trim();
    if (!body || !myUserId || !selected || sending) return;
    setSending(true);
    setInput("");

    const supabase = createClient();
    await supabase.from("messages").insert({
      league_id:   leagueId,
      sender_id:   myUserId,
      receiver_id: selected.userId,
      type:        "dm",
      body,
    });
    setSending(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#FAF7F2", color: "#1C1410" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .nav-link { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: #A89880; text-decoration: none; transition: color 0.15s; }
        .nav-link:hover, .nav-link.active { color: #FF5A1F; }
        .mgr-row { display: flex; align-items: center; gap: 10; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #EDE5D8; transition: background 0.12s; }
        .mgr-row:hover { background: #F0EAE0; }
        .mgr-row.active { background: #FFF5F0; border-right: 3px solid #FF5A1F; }
        .msg-bubble { max-width: 72%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; word-break: break-word; }
        .msg-mine { background: #FF5A1F; color: white; border-bottom-right-radius: 4px; }
        .msg-theirs { background: white; color: #1C1410; border: 1.5px solid #EDE5D8; border-bottom-left-radius: 4px; }
        .chat-input { flex: 1; padding: 12px 16px; border: 1.5px solid #EDE5D8; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 14px; resize: none; outline: none; background: white; transition: border-color 0.15s; color: #1C1410; }
        .chat-input:focus { border-color: #FF5A1F; }
        .send-btn { padding: 12px 20px; border-radius: 12px; border: none; background: #FF5A1F; color: white; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.07em; cursor: pointer; transition: opacity 0.15s; flex-shrink: 0; }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .send-btn:hover:not(:disabled) { opacity: 0.88; }
        .unread-dot { width: 8px; height: 8px; border-radius: 50%; background: #FF5A1F; flex-shrink: 0; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #EDE5D8", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 24, background: "white", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#FF5A1F", flexShrink: 0 }}>CURTIS</span>
        {navLinks.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link${l.label === "Messages" ? " active" : ""}`}>{l.label}</Link>
        ))}
      </nav>

      {/* Header */}
      <div style={{ padding: "16px 24px 12px", borderBottom: "1px solid #EDE5D8", background: "white", flexShrink: 0 }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A89880", marginBottom: 2 }}>{leagueName}</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900 }}>Direct Messages</h1>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr", overflow: "hidden" }}>

        {/* Left — manager list */}
        <div style={{ borderRight: "1px solid #EDE5D8", overflowY: "auto", background: "white" }}>
          {loading && (
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#A89880", padding: 16 }}>Loading…</p>
          )}
          {!loading && managers.length === 0 && (
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#A89880", padding: 16 }}>No other managers in this league.</p>
          )}
          {managers.map((mgr) => (
            <div
              key={mgr.userId}
              className={`mgr-row${selected?.userId === mgr.userId ? " active" : ""}`}
              onClick={() => selectManager(mgr)}
            >
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: "#FF5A1F", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "white",
              }}>
                {mgr.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mgr.username}</div>
                <div style={{ fontSize: 11, color: "#A89880", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mgr.teamName}</div>
              </div>
              {unread.has(mgr.userId) && <div className="unread-dot" />}
            </div>
          ))}
        </div>

        {/* Right — thread */}
        {!selected ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "#A89880" }}>
            <div style={{ fontSize: 32 }}>💬</div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Select a manager to start a conversation</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Thread header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #EDE5D8", background: "white", flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.username}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", letterSpacing: "0.06em" }}>{selected.teamName}</div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {threadLoading && (
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#A89880", alignSelf: "center" }}>Loading…</p>
              )}
              {!threadLoading && thread.length === 0 && (
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#A89880", alignSelf: "center", marginTop: 40 }}>
                  No messages yet. Start the conversation!
                </p>
              )}
              {thread.map((msg) => {
                const isMe = msg.sender_id === myUserId;
                return (
                  <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                    <div className={`msg-bubble ${isMe ? "msg-mine" : "msg-theirs"}`}>{msg.body}</div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#C4B8AA", marginTop: 3 }}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #EDE5D8", background: "white", display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
              <textarea
                ref={inputRef}
                className="chat-input"
                rows={1}
                placeholder={`Message ${selected.username}… (Enter to send)`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                style={{ minHeight: 46, maxHeight: 120 }}
              />
              <button onClick={send} disabled={!input.trim() || sending} className="send-btn">
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
