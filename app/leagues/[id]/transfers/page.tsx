"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavBar } from "@/components/NavBar";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useLeagueNavLinks } from "@/lib/use-league-nav-links";
import {
  isWindowOpen, timeUntilClose, timeUntilOpen, nextCloseTime, formatCountdown
} from "@/lib/transfer-window";

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = {
  id: string; name: string; club: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  season_points: number; gw_points: number;
};

type Listing = {
  id: string; league_id: string; seller_team_id: string;
  player_id: string; min_bid: number; buy_it_now_price: number | null;
  current_bid: number; leading_team_id: string | null;
  status: "active" | "sold" | "unsold" | "cancelled";
  listed_at: string; closes_at: string; sold_at: string | null;
  player: Player | null;
  seller_team: { name: string } | null;
  leading_team: { name: string } | null;
  bid_count?: number;
};

type HistoryListing = Listing & {
  buyer_team: { name: string } | null;
};

type SquadPlayer = { id: string; player_id: string; player: Player };

const POS_COLOR: Record<string, string> = { GK: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444" };
const POS_BG: Record<string, string> = {
  GK: "rgba(245,158,11,0.12)", DEF: "rgba(59,130,246,0.12)",
  MID: "rgba(16,185,129,0.12)", FWD: "rgba(239,68,68,0.12)",
};

function normalisePos(raw: string): "GK" | "DEF" | "MID" | "FWD" {
  const p = (raw ?? "").toUpperCase();
  if (p === "GK" || p.startsWith("G")) return "GK";
  if (p === "DEF" || p.startsWith("D")) return "DEF";
  if (p === "MID" || p.startsWith("M")) return "MID";
  return "FWD";
}

function PosBadge({ pos }: { pos: string }) {
  const n = normalisePos(pos);
  return (
    <span style={{
      fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700,
      padding: "2px 6px", borderRadius: 4,
      background: POS_BG[n], color: POS_COLOR[n],
    }}>{n}</span>
  );
}

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransfersPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const isMobile = useIsMobile();
  const navLinks = useLeagueNavLinks(leagueId);
  const now = useNow();
  const windowOpen = isWindowOpen(now);

  const [tab, setTab] = useState<"free" | "market" | "history">("free");
  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState("");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myCredits, setMyCredits] = useState(0);
  const [mySquad, setMySquad] = useState<SquadPlayer[]>([]);

  // Free agents
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [faSearch, setFaSearch] = useState("");
  const [faPosFilter, setFaPosFilter] = useState("ALL");
  const [claiming, setClaiming] = useState<string | null>(null);

  // Market
  const [listings, setListings] = useState<Listing[]>([]);
  const [bidTarget, setBidTarget] = useState<Listing | null>(null);
  const [bidAmount, setBidAmount] = useState(0);
  const [bidError, setBidError] = useState("");
  const [bidLoading, setBidLoading] = useState(false);
  const [buyTarget, setBuyTarget] = useState<Listing | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryListing[]>([]);

  useEffect(() => { load(); }, [leagueId]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: league }, { data: myTeamRow }] = await Promise.all([
      supabase.from("leagues").select("name").eq("id", leagueId).single(),
      supabase.from("teams").select("id, credits").eq("league_id", leagueId).eq("user_id", user.id).maybeSingle(),
    ]);

    if (league) setLeagueName(league.name);
    if (myTeamRow) { setMyTeamId(myTeamRow.id); setMyCredits(myTeamRow.credits ?? 0); }

    // All teams in league for owned player exclusion
    const { data: leagueTeams } = await supabase.from("teams").select("id").eq("league_id", leagueId);
    const leagueTeamIds = (leagueTeams ?? []).map(t => t.id);

    // Owned player IDs
    const { data: ownedRows } = leagueTeamIds.length
      ? await supabase.from("squad_players").select("player_id").in("team_id", leagueTeamIds)
      : { data: [] };
    const ownedIds = new Set((ownedRows ?? []).map(r => r.player_id));

    // Free agents
    const { data: allPlayers } = await supabase
      .from("players")
      .select("id, name, club, position, season_points, gw_points")
      .eq("is_available", true)
      .order("season_points", { ascending: false })
      .limit(1000);

    setFreeAgents(
      (allPlayers ?? [])
        .filter(p => !ownedIds.has(p.id))
        .map(p => ({ ...p, position: normalisePos(p.position) }))
    );

    // My squad
    if (myTeamRow) {
      const { data: squad } = await supabase
        .from("squad_players")
        .select("id, player_id, player:players(id,name,club,position,season_points,gw_points)")
        .eq("team_id", myTeamRow.id);
      setMySquad((squad ?? []) as unknown as SquadPlayer[]);
    }

    // Active listings
    await loadListings(supabase, leagueId);

    // History
    await loadHistory(supabase, leagueId);

    setLoading(false);
  }

  async function loadListings(supabase: ReturnType<typeof createClient>, lgId: string) {
    const { data } = await supabase
      .from("transfer_listings")
      .select(`
        id, league_id, seller_team_id, player_id, min_bid, buy_it_now_price,
        current_bid, leading_team_id, status, listed_at, closes_at, sold_at,
        player:players(id,name,club,position,season_points,gw_points),
        seller_team:teams!seller_team_id(name),
        leading_team:teams!leading_team_id(name)
      `)
      .eq("league_id", lgId)
      .eq("status", "active")
      .order("closes_at", { ascending: true });

    if (data) {
      // Get bid counts
      const ids = data.map(l => l.id);
      const { data: bidCounts } = ids.length
        ? await supabase.from("transfer_bids").select("listing_id").in("listing_id", ids).eq("status", "leading")
        : { data: [] };
      const countMap: Record<string, number> = {};
      for (const b of bidCounts ?? []) countMap[b.listing_id] = (countMap[b.listing_id] ?? 0) + 1;

      setListings(data.map(l => ({ ...l, bid_count: countMap[l.id] ?? 0 })) as unknown as Listing[]);
    }
  }

  async function loadHistory(supabase: ReturnType<typeof createClient>, lgId: string) {
    const { data } = await supabase
      .from("transfer_listings")
      .select(`
        id, league_id, seller_team_id, player_id, min_bid, buy_it_now_price,
        current_bid, leading_team_id, status, listed_at, closes_at, sold_at,
        player:players(id,name,club,position,season_points,gw_points),
        seller_team:teams!seller_team_id(name),
        leading_team:teams!leading_team_id(name)
      `)
      .eq("league_id", lgId)
      .in("status", ["sold", "unsold", "cancelled"])
      .order("closes_at", { ascending: false })
      .limit(50);

    if (data) setHistory(data as unknown as HistoryListing[]);
  }

  // Realtime subscription for listing updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`transfers:${leagueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transfer_listings", filter: `league_id=eq.${leagueId}` },
        () => { loadListings(supabase, leagueId); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [leagueId]);

  // Claim free agent
  async function claimPlayer(player: Player) {
    if (!myTeamId || claiming) return;
    setClaiming(player.id);
    const res = await fetch("/api/transfers/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leagueId, teamId: myTeamId, playerId: player.id }),
    });
    setClaiming(null);
    if (res.ok) {
      setFreeAgents(prev => prev.filter(p => p.id !== player.id));
    } else {
      const d = await res.json();
      alert(d.error ?? "Failed to claim player");
    }
  }

  // Place bid
  async function placeBid() {
    if (!bidTarget || !myTeamId) return;
    setBidError(""); setBidLoading(true);
    const res = await fetch("/api/transfers/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: bidTarget.id, teamId: myTeamId, bidAmount }),
    });
    const d = await res.json();
    setBidLoading(false);
    if (!res.ok) { setBidError(d.error ?? "Failed to place bid"); return; }
    setBidTarget(null);
    setMyCredits(prev => prev - bidAmount + (bidTarget.leading_team_id === myTeamId ? bidTarget.current_bid : 0));
    const supabase = createClient();
    await loadListings(supabase, leagueId);
  }

  // Buy it now
  async function buyNow() {
    if (!buyTarget || !myTeamId) return;
    setBuyLoading(true);
    const res = await fetch("/api/transfers/buy-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: buyTarget.id, teamId: myTeamId }),
    });
    const d = await res.json();
    setBuyLoading(false);
    if (!res.ok) { alert(d.error ?? "Failed to buy"); return; }
    setBuyTarget(null);
    await load();
  }

  // Filter free agents
  const filteredFa = freeAgents
    .filter(p => faPosFilter === "ALL" || p.position === faPosFilter)
    .filter(p => !faSearch.trim() || p.name.toLowerCase().includes(faSearch.toLowerCase()));

  if (loading) return (
    <div style={{ height: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--c-text-dim)", letterSpacing: "0.12em" }}>Loading…</span>
    </div>
  );

  const lowCredits = myCredits < 20;

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .tab-btn { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.15s; background: transparent; color: var(--c-text-muted); min-height: 40px; }
        .tab-btn.active { background: #FF5A1F; color: white; }
        .player-row { display: flex; align-items: center; gap: 12px; padding: 13px 16px; background: var(--c-bg-elevated); border-radius: 12px; border: 1.5px solid var(--c-border-strong); transition: border-color 0.15s; }
        .player-row:hover { border-color: rgba(255,90,31,0.4); }
        .action-btn { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em; padding: 7px 16px; border-radius: 7px; border: 1.5px solid #FF5A1F; background: var(--c-bg-elevated); color: #FF5A1F; cursor: pointer; white-space: nowrap; transition: all 0.15s; min-height: 40px; }
        .action-btn:hover:not(:disabled) { background: #FF5A1F; color: white; }
        .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .buy-btn { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em; padding: 7px 16px; border-radius: 7px; border: none; background: #16A34A; color: white; cursor: pointer; white-space: nowrap; transition: opacity 0.15s; min-height: 40px; }
        .buy-btn:hover { opacity: 0.85; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
        .modal { background: var(--c-bg-elevated); border-radius: 16px; padding: 28px; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto; }
        .input { width: 100%; padding: 10px 14px; border: 1.5px solid var(--c-input-border); border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 16px; outline: none; transition: border-color 0.15s; background: var(--c-input); color: var(--c-text); }
        .input:focus { border-color: #FF5A1F; }
        .primary-btn { width: 100%; padding: 13px; border-radius: 10px; border: none; background: #FF5A1F; color: white; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.15s; min-height: 44px; }
        .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .filter-btn { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.07em; padding: 5px 12px; border-radius: 6px; border: 1.5px solid var(--c-border-strong); background: var(--c-bg-elevated); cursor: pointer; transition: all 0.15s; color: var(--c-text-muted); min-height: 36px; }
        .filter-btn.active { border-color: #FF5A1F; color: #FF5A1F; background: var(--c-accent-dim); }
        .listing-card { background: var(--c-bg-elevated); border-radius: 14px; border: 1.5px solid var(--c-border-strong); padding: 16px; transition: border-color 0.15s; }
        .listing-card:hover { border-color: rgba(255,90,31,0.35); }
      `}</style>

      <NavBar links={navLinks} activeLabel="Transfers" right={<ThemeToggle size="sm" />} />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "20px 16px" : "32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--c-text-muted)", marginBottom: 4 }}>{leagueName}</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 22 : 28, fontWeight: 900, marginBottom: 12 }}>Transfer Market</h1>

          {/* Credit balance */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
              Balance:{" "}
              <span style={{ fontWeight: 700, color: lowCredits ? "#F59E0B" : "#FF5A1F", fontSize: 16 }}>
                {myCredits}
              </span>
              {" "}credits{lowCredits && <span style={{ color: "#F59E0B", fontSize: 11, marginLeft: 6 }}>⚠ low</span>}
            </div>
          </div>
        </div>

        {/* Window status banner */}
        <div style={{
          borderRadius: 10, padding: "12px 18px", marginBottom: 24,
          background: windowOpen ? "rgba(22,163,74,0.1)" : "rgba(239,68,68,0.08)",
          border: `1.5px solid ${windowOpen ? "rgba(22,163,74,0.3)" : "rgba(239,68,68,0.25)"}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: windowOpen ? "#16A34A" : "#EF4444",
            ...(windowOpen ? { animation: "pulse 2s infinite" } : {}),
          }} />
          <div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color: windowOpen ? "#16A34A" : "#EF4444", letterSpacing: "0.06em" }}>
              {windowOpen ? "TRANSFER WINDOW OPEN" : "TRANSFER WINDOW CLOSED"}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)", marginLeft: 10 }}>
              {windowOpen
                ? `Closes Friday 11pm · ${timeUntilClose(now)} remaining`
                : `Opens Monday midnight · ${timeUntilOpen(now)} until open`}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "var(--c-row)", borderRadius: 10, padding: 4, marginBottom: 24, width: "fit-content", flexWrap: "wrap" }}>
          {([
            { id: "free", label: "Free Agents" },
            { id: "market", label: `Market${listings.length ? ` (${listings.length})` : ""}` },
            { id: "history", label: "History" },
          ] as const).map(t => (
            <button key={t.id} className={`tab-btn${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: FREE AGENTS ── */}
        {tab === "free" && (
          <>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#FF5A1F", fontSize: 14, pointerEvents: "none" }}>⌕</span>
              <input
                type="text" placeholder="Search free agents…"
                value={faSearch} onChange={e => setFaSearch(e.target.value)}
                style={{ width: "100%", padding: "11px 14px 11px 38px", border: "2px solid #FF5A1F", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 16, outline: "none", background: "var(--c-bg-elevated)", color: "var(--c-text)" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["ALL", "GK", "DEF", "MID", "FWD"].map(pos => {
                const count = pos === "ALL" ? freeAgents.length : freeAgents.filter(p => p.position === pos).length;
                return (
                  <button key={pos} className={`filter-btn${faPosFilter === pos ? " active" : ""}`} onClick={() => setFaPosFilter(pos)}>
                    {pos} <span style={{ opacity: 0.65, fontSize: 9 }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredFa.length === 0 && (
                <p style={{ color: "var(--c-text-muted)", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
                  {faSearch ? `No players matching "${faSearch}"` : "No free agents available."}
                </p>
              )}
              {filteredFa.map(p => (
                <div key={p.id} className="player-row">
                  <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: POS_BG[p.position], display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, color: POS_COLOR[p.position] }}>{p.position}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", marginTop: 3 }}>{p.club}</div>
                  </div>
                  <div style={{ textAlign: "right", marginRight: 8, flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, lineHeight: 1, color: "var(--c-text)" }}>{p.season_points}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", marginTop: 2 }}>pts</div>
                  </div>
                  <button
                    className="action-btn"
                    disabled={!windowOpen || !!claiming || !myTeamId}
                    onClick={() => claimPlayer(p)}
                  >
                    {claiming === p.id ? "Claiming…" : windowOpen ? "Claim" : "Closed"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── TAB: TRANSFER MARKET ── */}
        {tab === "market" && (
          <>
            {listings.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--c-text-muted)", marginBottom: 8 }}>No active listings</p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--c-text-dim)" }}>
                  {windowOpen ? "Go to My Team to list a player for sale." : "The transfer window is closed. New listings will appear when it opens."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {listings.map(l => {
                  const p = l.player;
                  if (!p) return null;
                  const pos = normalisePos(p.position);
                  const closesMs = new Date(l.closes_at).getTime() - now.getTime();
                  const closing = closesMs < 3600_000; // < 1 hour
                  const isOwnListing = l.seller_team_id === myTeamId;
                  const isLeading = l.leading_team_id === myTeamId;

                  return (
                    <div key={l.id} className="listing-card" style={{ borderColor: isOwnListing ? "rgba(255,90,31,0.3)" : undefined }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        {/* Position badge */}
                        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: POS_BG[pos], display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, color: POS_COLOR[pos] }}>{pos}</span>
                        </div>

                        {/* Player info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--c-text)" }}>{p.name}</span>
                            {isOwnListing && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#FF5A1F", background: "rgba(255,90,31,0.1)", border: "1px solid rgba(255,90,31,0.25)", borderRadius: 4, padding: "1px 6px" }}>YOUR LISTING</span>}
                            {isLeading && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#16A34A", background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.25)", borderRadius: 4, padding: "1px 6px" }}>LEADING</span>}
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)" }}>{p.club}</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)" }}>{p.season_points} pts</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)" }}>by {l.seller_team?.name ?? "—"}</span>
                          </div>

                          {/* Bid info row */}
                          <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                            <div>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>CURRENT BID</span>
                              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "var(--c-text)", lineHeight: 1.1 }}>
                                {l.current_bid > 0 ? `${l.current_bid} cr` : <span style={{ fontSize: 13, color: "var(--c-text-muted)", fontFamily: "'DM Mono', monospace" }}>No bids</span>}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>MIN BID</span>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "var(--c-text-muted)" }}>{l.min_bid} cr</div>
                            </div>
                            {l.buy_it_now_price && (
                              <div>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>BUY NOW</span>
                                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#16A34A" }}>{l.buy_it_now_price} cr</div>
                              </div>
                            )}
                            <div>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", letterSpacing: "0.06em" }}>CLOSES</span>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: closing ? "#EF4444" : "var(--c-text)" }}>
                                {closesMs > 0 ? formatCountdown(closesMs) : "Ended"}
                                {closing && closesMs > 0 && <span style={{ marginLeft: 4, fontSize: 9 }}>⚡</span>}
                              </div>
                            </div>
                            {(l.bid_count ?? 0) > 0 && (
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)", background: "var(--c-row)", borderRadius: 5, padding: "2px 8px" }}>
                                {l.bid_count} bid{l.bid_count !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        {!isOwnListing && myTeamId && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                            <button
                              className="action-btn"
                              onClick={() => { setBidTarget(l); setBidAmount(Math.max(l.min_bid, l.current_bid + 1)); setBidError(""); }}
                            >
                              Bid
                            </button>
                            {l.buy_it_now_price && (
                              <button className="buy-btn" onClick={() => setBuyTarget(l)}>
                                Buy {l.buy_it_now_price} cr
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── TAB: HISTORY ── */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.length === 0 ? (
              <p style={{ color: "var(--c-text-muted)", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>No completed transfers yet.</p>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px", gap: 8, padding: "6px 12px", marginBottom: 4 }}>
                  {["Player", "Transfer", "Price", "Date"].map(h => (
                    <span key={h} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)" }}>{h}</span>
                  ))}
                </div>
                {history.map(l => {
                  const p = l.player;
                  const statusColor = l.status === "sold" ? "#16A34A" : l.status === "unsold" ? "#F59E0B" : "#A89880";
                  return (
                    <div key={l.id} style={{ background: "var(--c-bg-elevated)", borderRadius: 10, border: "1.5px solid var(--c-border-strong)", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px", gap: 8, alignItems: "center" }}>
                      <div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>{p?.name ?? "—"}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 2 }}><PosBadge pos={p?.position ?? ""} /><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)" }}>{p?.club}</span></div>
                      </div>
                      <div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)" }}>{l.seller_team?.name ?? "—"} → {l.leading_team?.name ?? "unsold"}</div>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: statusColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l.status}</span>
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: l.status === "sold" ? "#FF5A1F" : "var(--c-text-dim)" }}>
                        {l.status === "sold" ? `${l.current_bid} cr` : "—"}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-muted)" }}>
                        {l.sold_at ? new Date(l.sold_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : new Date(l.closes_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

      </div>

      {/* BID MODAL */}
      {bidTarget && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setBidTarget(null); }}>
          <div className="modal">
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Place Bid</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", marginBottom: 20 }}>
              <strong>{bidTarget.player?.name}</strong> · {bidTarget.player?.club} · {bidTarget.player?.position}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "var(--c-bg)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", marginBottom: 4 }}>CURRENT BID</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900 }}>{bidTarget.current_bid || "—"}</div>
              </div>
              <div style={{ background: "var(--c-bg)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", marginBottom: 4 }}>YOUR BALANCE</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: lowCredits ? "#F59E0B" : "var(--c-text)" }}>{myCredits}</div>
              </div>
            </div>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-text-muted)", display: "block", marginBottom: 6 }}>
              Your Bid (min {Math.max(bidTarget.min_bid, bidTarget.current_bid + 1)} cr)
            </label>
            <input
              type="number"
              className="input"
              value={bidAmount}
              min={Math.max(bidTarget.min_bid, bidTarget.current_bid + 1)}
              max={myCredits}
              onChange={e => setBidAmount(Number(e.target.value))}
              style={{ marginBottom: 16 }}
            />
            {bidError && <p style={{ color: "#EF4444", fontSize: 12, fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>{bidError}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setBidTarget(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid var(--c-border-strong)", background: "var(--c-bg-elevated)", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Cancel</button>
              <button
                className="primary-btn"
                style={{ flex: 2 }}
                disabled={bidLoading || bidAmount < Math.max(bidTarget.min_bid, bidTarget.current_bid + 1) || bidAmount > myCredits}
                onClick={placeBid}
              >
                {bidLoading ? "Placing…" : `Bid ${bidAmount} Credits`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUY IT NOW MODAL */}
      {buyTarget && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setBuyTarget(null); }}>
          <div className="modal">
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Buy It Now</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", marginBottom: 20 }}>
              <strong>{buyTarget.player?.name}</strong> from <strong>{buyTarget.seller_team?.name}</strong>
            </p>
            <div style={{ background: "var(--c-bg)", borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", marginBottom: 6 }}>YOU WILL PAY</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 900, color: "#FF5A1F" }}>{buyTarget.buy_it_now_price} cr</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)", marginTop: 4 }}>Balance after: {myCredits - (buyTarget.buy_it_now_price ?? 0)} cr</div>
            </div>
            {(myCredits < (buyTarget.buy_it_now_price ?? 0)) && (
              <p style={{ color: "#EF4444", fontSize: 12, fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>Not enough credits.</p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setBuyTarget(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid var(--c-border-strong)", background: "var(--c-bg-elevated)", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Cancel</button>
              <button
                className="buy-btn"
                style={{ flex: 2, width: undefined }}
                disabled={buyLoading || myCredits < (buyTarget.buy_it_now_price ?? 0)}
                onClick={buyNow}
              >
                {buyLoading ? "Processing…" : "Confirm Purchase"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
