"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/lib/use-is-mobile";

// ─── DRAFT CHAT ───────────────────────────────────────────────────────────────

type ChatMessage = { id: string; sender_id: string; body: string; created_at: string; senderName: string };

function DraftChat({ leagueId, myUserId }: { leagueId: string; myUserId: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase
      .from("messages")
      .select("id, sender_id, body, created_at, sender:profiles!sender_id(username)")
      .eq("league_id", leagueId)
      .eq("type", "draft")
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (!mounted || !data) return;
        setMessages(data.map((m: any) => ({ ...m, senderName: m.sender?.username ?? "?" })));
      });

    const channel = supabase
      .channel(`draft-chat-${leagueId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `league_id=eq.${leagueId}` }, async (payload) => {
        const row = payload.new as any;
        if (row.type !== "draft") return;
        const { data: profile } = await supabase.from("profiles").select("username").eq("id", row.sender_id).single();
        const msg: ChatMessage = { ...row, senderName: profile?.username ?? "?" };
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [leagueId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const body = input.trim();
    if (!body || !myUserId || sending) return;
    setSending(true);
    setInput("");
    const supabase = createClient();
    await supabase.from("messages").insert({ league_id: leagueId, sender_id: myUserId, type: "draft", body });
    setSending(false);
    inputRef.current?.focus();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {messages.length === 0 && (
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", alignSelf: "center", marginTop: 20, letterSpacing: "0.06em" }}>Draft room chat</p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === myUserId;
          const showName = !isMe && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              {showName && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-muted)", marginBottom: 2, letterSpacing: "0.05em" }}>{msg.senderName}</span>
              )}
              <div style={{
                maxWidth: "85%", padding: "7px 11px", borderRadius: 10, fontSize: 12, lineHeight: 1.45, wordBreak: "break-word",
                background: isMe ? "#FF5A1F" : "var(--c-input)",
                color: isMe ? "white" : "var(--c-text)",
                border: isMe ? "none" : "1px solid var(--c-border)",
                borderBottomRightRadius: isMe ? 3 : 10,
                borderBottomLeftRadius: isMe ? 10 : 3,
              }}>
                {msg.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, flexShrink: 0 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
          placeholder="Say something…"
          disabled={!myUserId}
          style={{
            flex: 1, padding: "8px 12px", background: "var(--c-input)", border: "1px solid var(--c-input-border)",
            borderRadius: 8, color: "var(--c-text)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending || !myUserId}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "none", background: "#FF5A1F", color: "white",
            fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.06em", cursor: "pointer", opacity: (!input.trim() || sending) ? 0.4 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

type DBPlayer = {
  id: string;
  name: string;
  club: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  api_rank: number | null;
  season_points: number;
};

type DBTeam = {
  id: string;
  name: string;
  user_id: string;
  draft_position: number;
  is_bot: boolean;
};

type DBPick = {
  id: string;
  league_id: string;
  team_id: string;
  player_id: string;
  round: number;
  pick_number: number;
};

type LeagueConfig = {
  id: string;
  name: string;
  squad_size: number;
  max_teams: number;
  draft_status: string;
  pick_time_seconds: number;
  draft_type: string;
  commissioner_id: string;
  is_public: boolean;
  draft_starts_at: string | null;
  target_teams: number | null;
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const POS_META: Record<string, { color: string; bg: string; border: string }> = {
  GK:  { color: "#92400E", bg: "#FEF9C3", border: "#FDE68A" },
  DEF: { color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  MID: { color: "#6B21A8", bg: "#F3E8FF", border: "#E9D5FF" },
  FWD: { color: "#C2410C", bg: "#FFF1EC", border: "#FED7AA" },
};

const CLUB_COLORS: Record<string, string> = {
  LIV: "#C8102E", ARS: "#EF0107", MCI: "#6CABDD", CHE: "#034694",
  AVL: "#670E36", BRE: "#E30613", TOT: "#132257", EVE: "#003399",
  NEW: "#241F20", FUL: "#CC0000", MUN: "#DA291C", BOU: "#DA291C",
  WHU: "#7A263A", WOL: "#FDB913", BRI: "#0057B8", NFO: "#E53233",
  IPS: "#3A64A3", LEI: "#003090", SOU: "#D71920", CRY: "#1B458F",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Pick number for board cell at [round, draftPosition] (1-indexed) */
function boardPickNum(round: number, draftPos: number, n: number): number {
  return round % 2 === 0
    ? (round - 1) * n + (n + 1 - draftPos)
    : (round - 1) * n + draftPos;
}

/** Which team picks at absolute pick number (1-indexed) */
function teamForPickNum(pickNum: number, teams: DBTeam[]): DBTeam | null {
  if (!teams.length) return null;
  const n = teams.length;
  const round = Math.ceil(pickNum / n);
  const posInRound = (pickNum - 1) % n;
  const isReversed = round % 2 === 0;
  const ordered = isReversed ? [...teams].slice().reverse() : teams;
  return ordered[posInRound] ?? null;
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function ClubBadge({ club, size = 24 }: { club: string; size?: number }) {
  const color = CLUB_COLORS[club] || "#555";
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: color, display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <span style={{ color: "white", fontSize: size * 0.45, fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
        {club[0]}
      </span>
    </div>
  );
}

function Timer({ seconds, total }: { seconds: number; total: number }) {
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const urgent = seconds <= 15;
  const color = seconds <= 10 ? "#DC2626" : seconds <= 20 ? "#D97706" : "#FF5A1F";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: 48, height: 48 }}>
        <svg width="48" height="48" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
          <circle cx="24" cy="24" r="20" fill="none" stroke={color}
            strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500,
          color: urgent ? color : "white",
        }}>{total === 0 ? "∞" : seconds}</div>
      </div>
    </div>
  );
}

// Auto-countdown for public drafts — triggers fill-bots when deadline arrives
function DraftCountdown({ target, leagueId, onStart }: { target: string; leagueId: string; onStart: () => void }) {
  const [label, setLabel] = useState("");
  const firedRef = useRef(false);

  useEffect(() => {
    function tick() {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) {
        setLabel("Starting…");
        if (!firedRef.current) {
          firedRef.current = true;
          fetch("/api/draft/fill-bots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leagueId }),
          }).then(() => onStart());
        }
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, leagueId, onStart]);

  return <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#FF5A1F" }}>{label}</span>;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function DraftRoomPage() {
  const params = useParams();
  const leagueId = params.id as string;

  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<"players" | "board" | "squad">("players");

  // ── Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<LeagueConfig | null>(null);
  const [teams, setTeams] = useState<DBTeam[]>([]);
  const [picks, setPicks] = useState<DBPick[]>([]);
  const [players, setPlayers] = useState<DBPlayer[]>([]);
  const [myTeam, setMyTeam] = useState<DBTeam | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ── UI state
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [timer, setTimer] = useState(60);
  const [activeTab, setActiveTab] = useState("available");
  const [lastPick, setLastPick] = useState<{ player: DBPlayer; teamId: string } | null>(null);
  const [boardView, setBoardView] = useState("board");
  const [saving, setSaving] = useState(false);
  const [rightPanel, setRightPanel] = useState<"squad" | "chat">("squad");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playersRef = useRef<DBPlayer[]>([]);
  const picksRef = useRef<DBPick[]>([]);
  const isMyTurnRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { picksRef.current = picks; }, [picks]);

  // ── Derived values
  const isCommissioner = !!(currentUserId && league?.commissioner_id === currentUserId);
  const totalRounds = league?.squad_size ?? 0;
  const totalPicks = teams.length * totalRounds;
  const currentPickNum = picks.length + 1;
  const isDraftComplete = totalPicks > 0 && picks.length >= totalPicks;
  const currentRound = teams.length > 0 ? Math.ceil(currentPickNum / teams.length) : 1;
  const currentTeam = isDraftComplete ? null : teamForPickNum(currentPickNum, teams);
  const isMyTurn = !!(currentTeam && myTeam && currentTeam.id === myTeam.id);
  const pickedPlayerIds = new Set(picks.map(p => p.player_id));
  const availablePlayers = players.filter(p => !pickedPlayerIds.has(p.id));
  const myPicks = picks
    .filter(p => p.team_id === myTeam?.id)
    .map(p => players.find(pl => pl.id === p.player_id))
    .filter((p): p is DBPlayer => Boolean(p));

  useEffect(() => { isMyTurnRef.current = isMyTurn; }, [isMyTurn]);

  // ── Load data
  useEffect(() => {
    if (!leagueId) return;
    async function load() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not logged in."); setLoading(false); return; }
      setCurrentUserId(user.id);

      const [leagueRes, teamsRes, picksRes, playersRes] = await Promise.all([
        supabase
          .from("leagues")
          .select("id, name, squad_size, max_teams, draft_status, pick_time_seconds, draft_type, commissioner_id, is_public, draft_starts_at, target_teams")
          .eq("id", leagueId)
          .single(),
        supabase
          .from("teams")
          .select("id, name, user_id, draft_position, is_bot")
          .eq("league_id", leagueId)
          .order("draft_position"),
        supabase
          .from("draft_picks")
          .select("id, league_id, team_id, player_id, round, pick_number")
          .eq("league_id", leagueId)
          .order("pick_number"),
        supabase
          .from("players")
          .select("id, name, club, position, api_rank, season_points")
          .eq("is_available", true)
          .order("api_rank", { ascending: true, nullsFirst: false }),
      ]);

      if (leagueRes.error || !leagueRes.data) {
        setError("League not found.");
        setLoading(false);
        return;
      }

      setLeague(leagueRes.data);
      const loadedTeams = teamsRes.data ?? [];
      setTeams(loadedTeams);
      setPicks(picksRes.data ?? []);
      setPlayers(playersRes.data ?? []);

      const me = loadedTeams.find(t => t.user_id === user.id) ?? null;
      setMyTeam(me);
      setLoading(false);
    }
    load();
  }, [leagueId]);

  // ── Realtime: draft picks + league status changes
  useEffect(() => {
    if (!leagueId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`draft:${leagueId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "draft_picks", filter: `league_id=eq.${leagueId}` },
        (payload) => {
          const newPick = payload.new as DBPick;
          setPicks(prev => {
            if (prev.some(p => p.pick_number === newPick.pick_number)) return prev;
            return [...prev, newPick].sort((a, b) => a.pick_number - b.pick_number);
          });
          const player = playersRef.current.find(p => p.id === newPick.player_id);
          if (player) {
            setLastPick({ player, teamId: newPick.team_id });
            setTimeout(() => setLastPick(null), 3000);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leagues", filter: `id=eq.${leagueId}` },
        (payload) => {
          setLeague(prev => prev ? { ...prev, ...(payload.new as Partial<LeagueConfig>) } : prev);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leagueId]);

  // ── Start draft (commissioner only)
  async function startDraft() {
    const supabase = createClient();
    const { error } = await supabase
      .from("leagues")
      .update({ draft_status: "live" })
      .eq("id", leagueId);
    if (!error) {
      setLeague(prev => prev ? { ...prev, draft_status: "live" } : prev);
    }
  }

  // ── Mark draft complete when all picks are in
  useEffect(() => {
    if (!isDraftComplete || !league || league.draft_status === "complete") return;
    const supabase = createClient();
    supabase.from("leagues").update({ draft_status: "complete" }).eq("id", leagueId);
    setLeague(prev => prev ? { ...prev, draft_status: "complete" } : prev);
  }, [isDraftComplete, league, leagueId]);

  // ── Bot auto-pick: first client to see it's a bot's turn fires the pick
  useEffect(() => {
    const currentTeamIsBot = currentTeam?.is_bot ?? false;
    if (!currentTeamIsBot || isDraftComplete || !league) return;

    const timeout = setTimeout(() => {
      const pickedIds = new Set(picksRef.current.map(p => p.player_id));
      const best = playersRef.current.find(p => !pickedIds.has(p.id));
      if (!best || !currentTeam) return;

      fetch("/api/draft/bot-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          teamId:     currentTeam.id,
          playerId:   best.id,
          pickNumber: currentPickNum,
          round:      currentRound,
        }),
      });
    }, 1500);

    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPickNum, isDraftComplete]);

  // ── Timer
  useEffect(() => {
    if (isDraftComplete || !league) return;
    const pickTime = league.pick_time_seconds || 60;
    setTimer(pickTime || 999);
    if (timerRef.current) clearInterval(timerRef.current);
    if (pickTime === 0) return; // no limit

    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          if (isMyTurnRef.current) {
            const pickedIds = new Set(picksRef.current.map(p => p.player_id));
            const best = playersRef.current.find(p => !pickedIds.has(p.id));
            if (best) makePick(best, true);
          }
          return pickTime;
        }
        return t - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPickNum, isDraftComplete, league?.pick_time_seconds]);

  // ── Make a pick
  const makePick = useCallback(async (player: DBPlayer, isAutopick = false) => {
    if (!myTeam || !league || saving || pickedPlayerIds.has(player.id) || isDraftComplete) return;
    if (!isMyTurnRef.current && !isAutopick) return;
    setSaving(true);

    const supabase = createClient();
    const round = Math.ceil(currentPickNum / Math.max(teams.length, 1));

    const { data: inserted, error: pickErr } = await supabase
      .from("draft_picks")
      .insert({
        league_id: leagueId,
        team_id: myTeam.id,
        player_id: player.id,
        round,
        pick_number: currentPickNum,
        is_autopick: isAutopick,
      })
      .select("id, league_id, team_id, player_id, round, pick_number")
      .single();

    if (!pickErr && inserted) {
      // Local update — realtime will deduplicate
      setPicks(prev => {
        if (prev.some(p => p.pick_number === inserted.pick_number)) return prev;
        return [...prev, inserted].sort((a, b) => a.pick_number - b.pick_number);
      });
      setLastPick({ player, teamId: myTeam.id });
      setTimeout(() => setLastPick(null), 3000);

      // Also write to squad_players
      await supabase.from("squad_players").insert({
        team_id: myTeam.id,
        player_id: player.id,
        is_starting: true,
        acquired_via: "draft",
      });
    }

    setSaving(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeam, league, saving, leagueId, currentPickNum, teams.length, isDraftComplete]);

  const toggleWatchlist = (id: string) => {
    setWatchlist(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id]);
  };

  const filteredPlayers = availablePlayers.filter(p => {
    const matchPos = posFilter === "ALL" || p.position === posFilter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.club.toLowerCase().includes(search.toLowerCase());
    return matchPos && matchSearch;
  });

  const watchlistPlayers = filteredPlayers.filter(p => watchlist.includes(p.id));
  const displayPlayers = activeTab === "watchlist" ? watchlistPlayers
                       : activeTab === "mysquad"   ? myPicks
                       : filteredPlayers;

  // Upcoming picks
  const upcomingPicks = Array.from({ length: 6 }, (_, i) => {
    const num = currentPickNum + i;
    if (num > totalPicks) return null;
    const team = teamForPickNum(num, teams);
    if (!team) return null;
    return { pickNum: num, team, isMe: team.id === myTeam?.id };
  }).filter(Boolean) as Array<{ pickNum: number; team: DBTeam; isMe: boolean }>;

  const navLinks = [
    { label: "Leagues",  href: "/" },
    { label: "Draft",    href: `/leagues/${leagueId}/draft` },
    { label: "Scoring",  href: `/leagues/${leagueId}/scoring` },
    { label: "Live",     href: `/leagues/${leagueId}/live` },
    { label: "Stats",    href: `/leagues/${leagueId}/table` },
    { label: "Waivers",  href: `/leagues/${leagueId}/waivers` },
    { label: "Trades",   href: `/leagues/${leagueId}/trades` },
    { label: "Chat",     href: `/leagues/${leagueId}/chat` },
    { label: "Messages", href: `/leagues/${leagueId}/messages` },
  ];

  const pickTime = league?.pick_time_seconds ?? 60;

  // ── Loading / Error states
  if (loading) {
    return (
      <div style={{ height: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--c-text-dim)", letterSpacing: "0.12em" }}>
          Loading draft room…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "var(--c-text)" }}>{error}</div>
        <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#FF5A1F", textDecoration: "none" }}>← Back to hub</Link>
      </div>
    );
  }

  // ── Pending: waiting for commissioner to start
  if (league?.draft_status === "pending") {
    return (
      <div style={{ height: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 0, color: "var(--c-text)" }}>
        <div style={{ width: "100%", maxWidth: 480, padding: "0 24px" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, letterSpacing: "0.08em" }}>CURTIS</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginTop: 6 }}>Draft Room</div>
          </div>

          <div style={{ background: "var(--c-bg-elevated)", borderRadius: 16, padding: "32px", border: "1.5px solid var(--c-border)" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 8 }}>
              {league.name}
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "var(--c-text)", margin: "0 0 24px 0" }}>
              {isCommissioner ? "Ready to start the draft?" : "Waiting for draft to start…"}
            </h1>

            {/* Managers list */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 10 }}>
                Managers joined ({teams.length} / {league.max_teams})
              </div>
              {teams.map(t => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 8, marginBottom: 4,
                  background: t.user_id === currentUserId ? "rgba(255,90,31,0.08)" : "var(--c-card)",
                  border: `1px solid ${t.user_id === currentUserId ? "rgba(255,90,31,0.2)" : "var(--c-card-border)"}`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: t.user_id === currentUserId ? "rgba(255,90,31,0.3)" : "var(--c-input)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'DM Mono', monospace", fontSize: 11, color: t.user_id === currentUserId ? "#FF5A1F" : "var(--c-text-muted)",
                  }}>
                    {t.draft_position}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--c-text)" }}>{t.name}</div>
                    {t.user_id === league.commissioner_id && (
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#FF5A1F", letterSpacing: "0.06em" }}>Commissioner</div>
                    )}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16A34A" }} />
                </div>
              ))}
            </div>

            {(() => {
              const pastDeadline = league.draft_starts_at ? new Date(league.draft_starts_at) < new Date() : false;

              // Public league past its scheduled time — anyone can trigger fill + start
              if (league.is_public && pastDeadline) {
                return (
                  <button
                    onClick={async () => {
                      await fetch("/api/draft/fill-bots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leagueId }) });
                      setLeague(prev => prev ? { ...prev, draft_status: "live" } : prev);
                    }}
                    style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#FF5A1F,#E8400A)", color: "white", border: "none", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(255,90,31,0.3)" }}
                  >
                    Fill with Bots & Start Draft
                  </button>
                );
              }

              // Public league with future start time — show countdown
              if (league.is_public && league.draft_starts_at) {
                return (
                  <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--c-card)", border: "1px solid var(--c-card-border)", textAlign: "center" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 6 }}>Draft starts in</div>
                    <DraftCountdown target={league.draft_starts_at} leagueId={leagueId} onStart={() => setLeague(prev => prev ? { ...prev, draft_status: "live" } : prev)} />
                  </div>
                );
              }

              // Private league: commissioner start button
              if (isCommissioner) {
                return (
                  <button onClick={startDraft} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#FF5A1F,#E8400A)", color: "white", border: "none", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(255,90,31,0.3)" }}>
                    {`Start Draft — ${teams.length} Manager${teams.length === 1 ? "" : "s"}`}
                  </button>
                );
              }

              // Everyone else: waiting
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 10, background: "var(--c-card)", border: "1px solid var(--c-card-border)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5A1F", animation: "pulse 1.5s infinite", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--c-text-muted)" }}>Waiting for the commissioner to start the draft…</span>
                </div>
              );
            })()}
          </div>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    );
  }

  // ── Render
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--c-bg)", color: "var(--c-text)" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .player-row {
          display: grid;
          grid-template-columns: 20px 28px 1fr 38px 52px 42px 32px;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.14s;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .player-row:hover { background: rgba(255,90,31,0.08); }
        .player-row.your-turn:hover { background: rgba(255,90,31,0.14); }

        .pick-btn {
          padding: 5px 12px;
          border-radius: 6px;
          border: none;
          background: #FF5A1F;
          color: white;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .pick-btn:hover { background: #E8400A; transform: scale(1.04); }
        .pick-btn:disabled { background: var(--c-input); color: var(--c-text-dim); cursor: default; transform: none; }

        .tab-btn {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 7px 14px;
          border-radius: 7px;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
          background: transparent;
          color: var(--c-text-muted);
        }
        .tab-btn:hover { color: var(--c-text); background: var(--c-input); }
        .tab-btn.active { background: rgba(255,90,31,0.15); color: #FF5A1F; }

        .pos-chip {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.08em;
          padding: 3px 6px;
          border-radius: 5px;
          text-align: center;
        }

        .board-cell {
          min-height: 54px;
          border-radius: 8px;
          padding: 7px 8px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          transition: all 0.2s;
        }

        .search-input {
          width: 100%;
          padding: 9px 12px 9px 32px;
          background: var(--c-input);
          border: 1px solid var(--c-input-border);
          border-radius: 8px;
          color: var(--c-text);
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          outline: none;
          transition: border-color 0.15s;
        }
        .search-input::placeholder { color: var(--c-text-dim); }
        .search-input:focus { border-color: rgba(255,90,31,0.4); }

        .pos-filter-btn {
          padding: 6px 12px;
          border-radius: 7px;
          border: 1px solid var(--c-border);
          background: transparent;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--c-text-muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .pos-filter-btn:hover { color: var(--c-text); border-color: var(--c-border-strong); }
        .pos-filter-btn.active { background: rgba(255,90,31,0.15); color: #FF5A1F; border-color: rgba(255,90,31,0.3); }

        .squad-slot {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 7px;
          background: var(--c-card);
          border: 1px solid var(--c-card-border);
          margin-bottom: 4px;
        }

        .nav-link {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          text-decoration: none;
          padding: 4px 0;
          transition: color 0.15s;
          display: inline-block;
        }
        .nav-link:hover { color: rgba(255,255,255,0.7); }
        .nav-link.active { color: #FF5A1F; }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .last-pick-toast { animation: slideIn 0.3s ease; }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: var(--c-border-strong); border-radius: 2px; }

        @media (max-width: 768px) {
          .player-row {
            grid-template-columns: 28px 1fr 38px 42px 32px;
            gap: 6px;
            padding: 8px 10px;
          }
          .player-row .rank-col { display: none; }
          .player-row .club-col { display: none; }
        }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{
        height: 56, background: "var(--c-bg-elevated)",
        borderBottom: "1px solid var(--c-border)",
        display: "flex", alignItems: "center",
        padding: "0 20px", gap: 20, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg,#FF5A1F,#E8400A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(255,90,31,0.4)",
          }}>
            <span style={{ color: "white", fontSize: 13 }}>◆</span>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 900, letterSpacing: "-0.02em" }}>CURTIS</div>
        </div>

        {/* Nav */}
        <div style={{ display: isMobile ? "none" : "flex", gap: 16, paddingLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
          {navLinks.map(item => (
            <Link key={item.label} href={item.href} className={`nav-link${item.label === "Draft" ? " active" : ""}`}>{item.label}</Link>
          ))}
        </div>

        {/* Draft status */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, paddingLeft: isMobile ? 8 : 20, borderLeft: "1px solid var(--c-border)", overflow: "hidden" }}>
          {!isMobile && (
            <>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-muted)", marginBottom: 2 }}>League</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--c-text)", lineHeight: 1, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{league?.name}</div>
              </div>
              <div style={{ width: 1, height: 28, background: "var(--c-border)" }} />
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-muted)", marginBottom: 2 }}>Round</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "var(--c-text)", lineHeight: 1 }}>{currentRound}</div>
              </div>
              <div style={{ width: 1, height: 28, background: "var(--c-border)" }} />
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-muted)", marginBottom: 2 }}>Pick</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "var(--c-text)", lineHeight: 1 }}>
                  {isDraftComplete ? "Done" : currentPickNum}
                  {!isDraftComplete && <span style={{ fontSize: 11, color: "var(--c-text-dim)", fontFamily: "'DM Mono', monospace" }}> / {totalPicks}</span>}
                </div>
              </div>
              <div style={{ width: 1, height: 28, background: "var(--c-border)" }} />
              <div style={{ flex: 1, maxWidth: 200 }}>
                <div style={{ height: 4, background: "var(--c-border)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    background: "linear-gradient(90deg,#FF5A1F,#E8400A)",
                    width: `${totalPicks > 0 ? ((picks.length) / totalPicks) * 100 : 0}%`,
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", marginTop: 3, letterSpacing: "0.06em" }}>
                  {picks.length} picks made · {Math.max(0, totalPicks - picks.length)} remaining
                </div>
              </div>
            </>
          )}
          {isMobile && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)", flexShrink: 0 }}>
              R{currentRound} · {isDraftComplete ? "Done" : `Pick ${currentPickNum}/${totalPicks}`}
            </div>
          )}
        </div>

        <ThemeToggle />

        {/* Current pick indicator */}
        {!isDraftComplete ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "8px 16px", borderRadius: 10,
            background: isMyTurn ? "rgba(255,90,31,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${isMyTurn ? "rgba(255,90,31,0.3)" : "rgba(255,255,255,0.08)"}`,
          }}>
            {isMyTurn ? (
              <>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5A1F", boxShadow: "0 0 0 3px rgba(255,90,31,0.2)", animation: "pulse 1.5s infinite" }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#FF5A1F", letterSpacing: "0.08em" }}>YOUR PICK</span>
                <Timer seconds={timer} total={pickTime} />
              </>
            ) : (
              <>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-text-dim)" }} />
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.08em", marginBottom: 1 }}>ON THE CLOCK</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "var(--c-text-muted)" }}>
                    {currentTeam?.name ?? "—"}
                  </div>
                </div>
                <Timer seconds={timer} total={pickTime} />
              </>
            )}
          </div>
        ) : (
          <div style={{
            padding: "8px 16px", borderRadius: 10,
            background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.25)",
            fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#16A34A", letterSpacing: "0.08em",
          }}>
            ✓ Draft Complete
          </div>
        )}
      </div>

      {/* ── BODY ── */}
      <div style={{
        flex: 1,
        display: isMobile ? "flex" : "grid",
        gridTemplateColumns: isMobile ? undefined : "1fr 340px",
        flexDirection: isMobile ? "column" : undefined,
        overflow: "hidden",
        paddingBottom: isMobile ? 56 : 0,
      }}>

        {/* LEFT — Draft Board + Player Browser */}
        <div style={{
          display: isMobile && mobileTab === "squad" ? "none" : "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)",
          flex: isMobile ? 1 : undefined,
        }}>

          {/* Draft Board */}
          <div style={{
            flexShrink: 0, padding: "12px 16px",
            borderBottom: "1px solid var(--c-border)",
            background: "var(--c-bg-elevated)",
            display: isMobile && mobileTab === "players" ? "none" : "block",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)" }}>
                Draft Board — {league?.draft_type === "snake" ? "Snake" : league?.draft_type ?? "Snake"} Order · {teams.length} Teams · {totalRounds} Rounds
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {["board", "rounds"].map(v => (
                  <button key={v} onClick={() => setBoardView(v)} style={{
                    padding: "4px 10px", borderRadius: 6,
                    border: `1px solid ${boardView === v ? "rgba(255,90,31,0.3)" : "rgba(255,255,255,0.06)"}`,
                    background: boardView === v ? "rgba(255,90,31,0.12)" : "transparent",
                    fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em",
                    color: boardView === v ? "#FF5A1F" : "#4A3E34", cursor: "pointer", textTransform: "uppercase",
                  }}>{v}</button>
                ))}
              </div>
            </div>

            {teams.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)" }}>
                Waiting for managers to join…
              </div>
            ) : (
              <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 260 }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `52px repeat(${teams.length}, minmax(88px, 1fr))`,
                  gap: 3,
                  minWidth: teams.length * 90 + 60,
                }}>
                  {/* Header row */}
                  <div />
                  {teams.map(team => (
                    <div key={team.id} style={{
                      padding: "5px 6px", borderRadius: 6,
                      background: team.user_id === currentUserId ? "rgba(255,90,31,0.12)" : "var(--c-card)",
                      border: `1px solid ${team.user_id === currentUserId ? "rgba(255,90,31,0.2)" : "var(--c-card-border)"}`,
                      textAlign: "center",
                    }}>
                      <div style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 9,
                        color: team.user_id === currentUserId ? "#FF5A1F" : team.is_bot ? "var(--c-text-dim)" : "var(--c-text-muted)",
                        letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {team.user_id === currentUserId ? "YOU" : team.is_bot ? "🤖 BOT" : team.name.slice(0, 6)}
                      </div>
                    </div>
                  ))}

                  {/* Rounds */}
                  {Array.from({ length: totalRounds }, (_, rIdx) => {
                    const round = rIdx + 1;
                    return [
                      <div key={`r${round}`} style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.08em",
                      }}>R{round}</div>,
                      ...teams.map(team => {
                        const bpn = boardPickNum(round, team.draft_position, teams.length);
                        const isCurrent = bpn === currentPickNum && !isDraftComplete;
                        const pick = picks.find(p => p.pick_number === bpn);
                        const player = pick ? players.find(pl => pl.id === pick.player_id) : null;
                        const isMe = team.user_id === currentUserId;

                        return (
                          <div key={`${round}-${team.id}`} className="board-cell" style={{
                            background: isCurrent
                              ? "rgba(255,90,31,0.15)"
                              : player
                                ? isMe ? "rgba(255,90,31,0.08)" : "var(--c-card)"
                                : "var(--c-bg)",
                            border: `1px solid ${isCurrent ? "rgba(255,90,31,0.35)" : "var(--c-card-border)"}`,
                          }}>
                            {isCurrent && !player ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF5A1F", animation: "pulse 1s infinite" }} />
                                <span style={{ color: "#FF5A1F", fontSize: 9, letterSpacing: "0.06em" }}>LIVE</span>
                              </div>
                            ) : player ? (
                              <>
                                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, color: "var(--c-text)", lineHeight: 1.2, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {player.name}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  <span style={{
                                    fontSize: 8, padding: "1px 4px", borderRadius: 3,
                                    background: POS_META[player.position].bg,
                                    color: POS_META[player.position].color,
                                    fontFamily: "'DM Mono', monospace",
                                  }}>{player.position}</span>
                                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "var(--c-text-dim)" }}>{player.club}</span>
                                </div>
                              </>
                            ) : (
                              <span style={{ color: "var(--c-text-dim)", fontFamily: "'DM Mono', monospace", fontSize: 9 }}>—</span>
                            )}
                          </div>
                        );
                      })
                    ];
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Upcoming picks strip */}
          {!isDraftComplete && upcomingPicks.length > 0 && (
            <div style={{
              flexShrink: 0, padding: "8px 16px",
              borderBottom: "1px solid var(--c-border)",
              background: "var(--c-bg)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)", marginRight: 4, flexShrink: 0 }}>Up next:</span>
              {upcomingPicks.map((p) => (
                <div key={p.pickNum} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 7,
                  background: p.isMe ? "rgba(255,90,31,0.1)" : "var(--c-card)",
                  border: `1px solid ${p.isMe ? "rgba(255,90,31,0.2)" : "var(--c-card-border)"}`,
                  flexShrink: 0,
                }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "var(--c-text-dim)" }}>#{p.pickNum}</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: p.isMe ? "#FF5A1F" : "var(--c-text-muted)", fontWeight: p.isMe ? 600 : 400 }}>
                    {p.isMe ? "YOU" : p.team.name.slice(0, 8)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Player browser */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 16px 0" }}>
            {/* Search + filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexShrink: 0 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-dim)", fontSize: 12 }}>⌕</span>
                <input className="search-input" placeholder="Search players..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["ALL", "GK", "DEF", "MID", "FWD"].map(pos => (
                  <button key={pos} className={`pos-filter-btn${posFilter === pos ? " active" : ""}`} onClick={() => setPosFilter(pos)}>{pos}</button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, marginBottom: 8, flexShrink: 0, background: "var(--c-card)", borderRadius: 8, padding: 3 }}>
              {[
                { id: "available", label: `Available (${availablePlayers.length})` },
                { id: "watchlist", label: `Watchlist (${watchlist.length})` },
                { id: "mysquad",   label: `My Squad (${myPicks.length})` },
              ].map(t => (
                <button key={t.id} className={`tab-btn${activeTab === t.id ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
              ))}
            </div>

            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "28px 1fr 38px 42px 32px" : "20px 28px 1fr 38px 52px 42px 32px",
              gap: 8, padding: "4px 12px 6px",
              borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0,
            }}>
              {(isMobile ? ["", "Player", "Pos", "Pts", ""] : ["#", "", "Player", "Pos", "Club", "Pts", ""]).map((h, i) => (
                <span key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)", textAlign: i > (isMobile ? 1 : 2) ? "center" : "left" }}>{h}</span>
              ))}
            </div>

            {/* Player list */}
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: 12 }}>
              {players.length === 0 ? (
                <div style={{ padding: "40px 12px", textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--c-text-dim)", letterSpacing: "0.08em", marginBottom: 8 }}>
                    No players in the database.
                  </div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--c-text-dim)", lineHeight: 1.5 }}>
                    Run the API-Football sync to populate players before starting the draft.
                  </div>
                </div>
              ) : displayPlayers.length === 0 ? (
                <div style={{ padding: "32px 12px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--c-text-dim)", letterSpacing: "0.08em" }}>
                  {activeTab === "watchlist" ? "No players on watchlist" : "No players found"}
                </div>
              ) : (
                displayPlayers.map((player, idx) => {
                  const isOwned = pickedPlayerIds.has(player.id);
                  const onWatchlist = watchlist.includes(player.id);
                  if (isOwned && activeTab !== "mysquad") return null;
                  const pos = POS_META[player.position];
                  return (
                    <div key={player.id} className={`player-row${isMyTurn && !isOwned ? " your-turn" : ""}`}
                      style={{
                        opacity: isOwned && activeTab !== "mysquad" ? 0.4 : 1,
                        gridTemplateColumns: isMobile ? "28px 1fr 38px 42px 32px" : "20px 28px 1fr 38px 52px 42px 32px",
                      }}
                    >
                      {!isMobile && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)" }}>{idx + 1}</span>}
                      <ClubBadge club={player.club} size={22} />
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                          {player.name}
                        </span>
                      </div>
                      <span className="pos-chip" style={{ background: pos.bg, color: pos.color, border: `1px solid ${pos.border}` }}>{player.position}</span>
                      {!isMobile && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)", textAlign: "center" }}>{player.club}</span>}
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "#FF5A1F", textAlign: "center" }}>{player.season_points}</span>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        {activeTab !== "mysquad" && (
                          <>
                            <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleWatchlist(player.id); }} style={{
                              width: 22, height: 22, borderRadius: 5, border: "none",
                              background: onWatchlist ? "rgba(255,90,31,0.15)" : "rgba(255,255,255,0.05)",
                              color: onWatchlist ? "#FF5A1F" : "#4A3E34", cursor: "pointer", fontSize: 10,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>{onWatchlist ? "★" : "☆"}</button>
                            <button
                              className="pick-btn"
                              disabled={!isMyTurn || isOwned || saving || isDraftComplete}
                              onClick={() => makePick(player)}
                            >Pick</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Squad / Chat panel */}
        <div style={{
          display: isMobile && mobileTab !== "squad" ? "none" : "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--c-bg)",
          flex: isMobile ? 1 : undefined,
        }}>

          {/* Panel tab toggle */}
          <div style={{ display: "flex", gap: 2, padding: "8px 10px 0", flexShrink: 0 }}>
            {(["squad", "chat"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setRightPanel(p)}
                style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em",
                  textTransform: "uppercase", padding: "6px 14px", borderRadius: 7, border: "none",
                  cursor: "pointer", transition: "all 0.15s",
                  background: rightPanel === p ? "rgba(255,90,31,0.15)" : "transparent",
                  color: rightPanel === p ? "#FF5A1F" : "#6B5E52",
                }}
              >
                {p === "squad" ? "My Squad" : "💬 Chat"}
              </button>
            ))}
          </div>

          {/* Last pick toast — always visible */}
          {lastPick && (
            <div className="last-pick-toast" style={{
              margin: "10px 14px 0", padding: "10px 14px", borderRadius: 10,
              background: lastPick.teamId === myTeam?.id ? "rgba(255,90,31,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${lastPick.teamId === myTeam?.id ? "rgba(255,90,31,0.3)" : "rgba(255,255,255,0.08)"}`,
              display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
            }}>
              <ClubBadge club={lastPick.player.club} size={28} />
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>{lastPick.player.name}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: lastPick.teamId === myTeam?.id ? "#FF5A1F" : "#6B5E52", letterSpacing: "0.06em", marginTop: 2 }}>
                  {lastPick.teamId === myTeam?.id
                    ? "✓ Your pick"
                    : `Picked by ${teams.find(t => t.id === lastPick.teamId)?.name ?? "—"}`}
                </div>
              </div>
            </div>
          )}

          {/* My Squad — only when squad tab active */}
          {rightPanel === "chat" && <DraftChat leagueId={leagueId} myUserId={currentUserId} />}
          <div style={{ display: rightPanel === "squad" ? "contents" : "none" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 10 }}>
              {myTeam ? `${myTeam.name} (${myPicks.length} / ${totalRounds})` : "Not in this league"}
            </div>

            {(["GK", "DEF", "MID", "FWD"] as const).map(pos => {
              const posPlayers = myPicks.filter(p => p.position === pos);
              const pm = POS_META[pos];
              return (
                <div key={pos} style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: pm.color, marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ padding: "2px 6px", borderRadius: 4, background: pm.bg, border: `1px solid ${pm.border}` }}>{pos}</span>
                    <span style={{ color: "var(--c-text-dim)" }}>{posPlayers.length} picked</span>
                  </div>
                  {posPlayers.map(player => (
                    <div key={player.id} className="squad-slot">
                      <ClubBadge club={player.club} size={22} />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "var(--c-text)", flex: 1 }}>{player.name}</span>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: "#FF5A1F" }}>{player.season_points}</span>
                    </div>
                  ))}
                  {posPlayers.length === 0 && (
                    <div style={{ padding: "7px 10px", borderRadius: 7, border: "1px dashed var(--c-border)", fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>
                      No {pos} picked yet
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Autopick suggestion */}
          {isMyTurn && availablePlayers.length > 0 && (
            <div style={{
              margin: "0 14px 14px", padding: "12px 14px", borderRadius: 10,
              background: "rgba(255,90,31,0.08)", border: "1px solid rgba(255,90,31,0.2)", flexShrink: 0,
            }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#FF5A1F", marginBottom: 6, textTransform: "uppercase" }}>
                ⚡ It&apos;s your pick!
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 10, lineHeight: 1.4 }}>
                Best available: <strong style={{ color: "var(--c-text)" }}>{availablePlayers[0]?.name}</strong> ({availablePlayers[0]?.position} · {availablePlayers[0]?.season_points} pts)
              </div>
              <button
                onClick={() => availablePlayers[0] && makePick(availablePlayers[0])}
                disabled={saving}
                style={{
                  width: "100%", padding: "9px", borderRadius: 8, border: "none",
                  background: saving ? "#4A3E34" : "linear-gradient(135deg,#FF5A1F,#E8400A)",
                  color: "white", fontFamily: "'DM Mono', monospace",
                  fontSize: 11, letterSpacing: "0.07em", cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: saving ? "none" : "0 3px 12px rgba(255,90,31,0.3)",
                }}
              >
                {saving ? "Saving…" : "Auto-pick Best"}
              </button>
            </div>
          )}
          </div>{/* end squad panel wrapper */}
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="mobile-tab-bar">
        {(["players", "board", "squad"] as const).map(tab => {
          const labels = { players: "Players", board: "Board", squad: "Squad" };
          const icons  = { players: "⚽", board: "📋", squad: "👥" };
          const isActive = mobileTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              style={{
                flex: 1,
                height: "100%",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                color: isActive ? "#FF5A1F" : "var(--c-text-muted)",
                borderTop: `2px solid ${isActive ? "#FF5A1F" : "transparent"}`,
                transition: "color 0.15s",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{icons[tab]}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {labels[tab]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
