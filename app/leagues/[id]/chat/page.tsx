"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender: { username: string } | null;
};

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

export default function LeagueChatPage() {
  const params = useParams();
  const leagueId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

      const [{ data: league }, { data: profile }, { data: msgs }] = await Promise.all([
        supabase.from("leagues").select("name").eq("id", leagueId).single(),
        supabase.from("profiles").select("username").eq("id", user.id).single(),
        supabase
          .from("messages")
          .select("id, sender_id, body, created_at, sender:profiles!sender_id(username)")
          .eq("league_id", leagueId)
          .eq("type", "league")
          .order("created_at", { ascending: true })
          .limit(200),
      ]);

      if (!mounted) return;
      if (league) setLeagueName(league.name);
      if (profile) setMyUsername(profile.username);
      if (msgs) setMessages(msgs as unknown as Message[]);
      setLoading(false);
    }

    init();

    // Realtime
    const channel = supabase
      .channel(`league-chat-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `league_id=eq.${leagueId}` },
        async (payload) => {
          const row = payload.new as { id: string; sender_id: string; body: string; created_at: string; type: string };
          if (row.type !== "league") return;
          // Fetch sender username
          const { data: sender } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", row.sender_id)
            .single();
          const msg: Message = { ...row, sender: sender ?? null };
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [leagueId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = input.trim();
    if (!body || !myUserId || sending) return;
    setSending(true);
    setInput("");

    const supabase = createClient();
    await supabase.from("messages").insert({
      league_id: leagueId,
      sender_id: myUserId,
      type: "league",
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
        .msg-bubble {
          max-width: 68%;
          padding: 12px 18px;
          border-radius: 18px;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          line-height: 1.55;
          word-break: break-word;
        }
        .msg-mine {
          background: #FF5A1F;
          color: white;
          border-bottom-right-radius: 5px;
        }
        .msg-theirs {
          background: white;
          color: #1C1410;
          border: 1.5px solid #EDE5D8;
          border-bottom-left-radius: 5px;
        }
        .chat-input {
          flex: 1;
          padding: 14px 18px;
          border: 2px solid #EDE5D8;
          border-radius: 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          resize: none;
          outline: none;
          background: white;
          transition: border-color 0.15s;
          color: #1C1410;
          line-height: 1.5;
        }
        .chat-input:focus { border-color: #FF5A1F; }
        .chat-input::placeholder { color: #C4B8AA; }
        .send-btn {
          height: 52px;
          padding: 0 28px;
          border-radius: 14px;
          border: none;
          background: #FF5A1F;
          color: white;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.07em;
          cursor: pointer;
          transition: opacity 0.15s;
          flex-shrink: 0;
          align-self: flex-end;
        }
        .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .send-btn:hover:not(:disabled) { opacity: 0.85; }
        .sender-name {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.05em;
          color: #A89880;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .sender-name-me { color: #FF5A1F; }
        .msg-time {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: #C4B8AA;
          margin-top: 4px;
          letter-spacing: 0.03em;
        }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #EDE5D8", padding: "0 20px", height: 56, display: "flex", alignItems: "center", gap: 20, background: "white", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#FF5A1F", flexShrink: 0 }}>CURTIS</span>
        {navLinks.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link${l.label === "Chat" ? " active" : ""}`}>{l.label}</Link>
        ))}
        <span style={{ marginLeft: "auto", fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#1C1410", flexShrink: 0 }}>
          {leagueName} · League Chat
        </span>
      </nav>

      {/* Messages — flex:1, spacer at top pushes messages to bottom */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px", display: "flex", flexDirection: "column" }}>

        {/* Top spacer — forces messages to bottom when list is short */}
        <div style={{ flex: 1 }} />

        {loading && (
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#A89880", alignSelf: "center", marginBottom: 24 }}>Loading…</p>
        )}
        {!loading && messages.length === 0 && (
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#A89880", alignSelf: "center", marginBottom: 24 }}>
            No messages yet — say something!
          </p>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.sender_id === myUserId;
          const prevMsg = messages[i - 1];
          const isNewGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
          const senderName = isMe ? (myUsername || "You") : (msg.sender?.username ?? "Unknown");

          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isMe ? "flex-end" : "flex-start",
                marginTop: isNewGroup ? 20 : 6,
              }}
            >
              {isNewGroup && (
                <span className={`sender-name${isMe ? " sender-name-me" : ""}`}>
                  {senderName}
                </span>
              )}
              <div className={`msg-bubble ${isMe ? "msg-mine" : "msg-theirs"}`}>
                {msg.body}
              </div>
              <span className="msg-time">{formatTime(msg.created_at)}</span>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input bar — fixed at bottom */}
      <div style={{
        padding: "16px 32px 24px",
        borderTop: "1.5px solid #EDE5D8",
        background: "white",
        display: "flex",
        gap: 12,
        alignItems: "flex-end",
        flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          className="chat-input"
          rows={1}
          placeholder="Message the league…  (Enter to send · Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          style={{ minHeight: 52, maxHeight: 140 }}
        />
        <button onClick={send} disabled={!input.trim() || sending} className="send-btn">
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
