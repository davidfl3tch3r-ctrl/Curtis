"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { NavBar } from "@/components/NavBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/lib/use-is-mobile";

// ─── Formations ───────────────────────────────────────────────────────────────

type PosType = "GK" | "DEF" | "MID" | "FWD";

interface FormationLine { count: number; y: number; pos: PosType }
interface FormationSlot { idx: number; x: number; y: number; pos: PosType }

const FORMATIONS: Record<string, FormationLine[]> = {
  "4-3-3": [
    { count: 1, y: 85, pos: "GK"  },
    { count: 4, y: 67, pos: "DEF" },
    { count: 3, y: 48, pos: "MID" },
    { count: 3, y: 26, pos: "FWD" },
  ],
  "4-4-2": [
    { count: 1, y: 85, pos: "GK"  },
    { count: 4, y: 67, pos: "DEF" },
    { count: 4, y: 47, pos: "MID" },
    { count: 2, y: 24, pos: "FWD" },
  ],
  "4-2-3-1": [
    { count: 1, y: 85, pos: "GK"  },
    { count: 4, y: 69, pos: "DEF" },
    { count: 2, y: 56, pos: "MID" },
    { count: 3, y: 40, pos: "MID" },
    { count: 1, y: 22, pos: "FWD" },
  ],
  "3-5-2": [
    { count: 1, y: 85, pos: "GK"  },
    { count: 3, y: 67, pos: "DEF" },
    { count: 5, y: 47, pos: "MID" },
    { count: 2, y: 24, pos: "FWD" },
  ],
  "3-4-3": [
    { count: 1, y: 85, pos: "GK"  },
    { count: 3, y: 67, pos: "DEF" },
    { count: 4, y: 47, pos: "MID" },
    { count: 3, y: 24, pos: "FWD" },
  ],
  "5-3-2": [
    { count: 1, y: 85, pos: "GK"  },
    { count: 5, y: 67, pos: "DEF" },
    { count: 3, y: 47, pos: "MID" },
    { count: 2, y: 24, pos: "FWD" },
  ],
  "5-4-1": [
    { count: 1, y: 85, pos: "GK"  },
    { count: 5, y: 68, pos: "DEF" },
    { count: 4, y: 47, pos: "MID" },
    { count: 1, y: 23, pos: "FWD" },
  ],
};

function getFormationSlots(formation: string): FormationSlot[] {
  const lines = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const slots: FormationSlot[] = [];
  let idx = 0;
  for (const line of lines) {
    const xs = line.count === 1
      ? [50]
      : Array.from({ length: line.count }, (_, i) => 9 + (i * (82 / (line.count - 1))));
    for (const x of xs) {
      slots.push({ idx: idx++, x, y: line.y, pos: line.pos });
    }
  }
  return slots;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SquadPlayer {
  squadId: string;
  playerId: string;
  name: string;
  shortName: string;
  club: string;
  position: PosType;
  gwPoints: number;
  isCaptain: boolean;
  isVC: boolean;
  isStarting: boolean;
  benchOrder: number | null;
}

const POS_COLORS: Record<PosType, { bg: string; text: string }> = {
  GK:  { bg: "#78350f", text: "#FEF9C3" },
  DEF: { bg: "#1e3a8a", text: "#DBEAFE" },
  MID: { bg: "#4c1d95", text: "#EDE9FE" },
  FWD: { bg: "#7c2d12", text: "#FFF1EC" },
};

const CLUB_COLORS: Record<string, string> = {
  LIV:"#C8102E", ARS:"#EF0107", MCI:"#6CABDD", CHE:"#034694",
  AVL:"#670E36", BRE:"#E30613", TOT:"#132257", EVE:"#003399",
  NEW:"#241F20", FUL:"#CC0000", MUN:"#DA291C", BOU:"#C0392B",
  WHU:"#7A263A", WOL:"#FDB913", NFO:"#E53233", IPS:"#3A64A3",
  LEI:"#003090", SOU:"#D71920", CRY:"#1B458F", BHA:"#0057B8",
};

function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) return name.slice(0, 9);
  return parts[parts.length - 1].slice(0, 9);
}

// ─── Countdown to lockout ─────────────────────────────────────────────────────

function getNextLockout(): Date {
  const now = new Date();
  const daysUntilSat = ((6 - now.getDay()) + 7) % 7 || 7;
  const lockout = new Date(now);
  lockout.setDate(lockout.getDate() + daysUntilSat);
  lockout.setHours(11, 0, 0, 0);
  return lockout;
}

function useCountdown(target: Date) {
  const [diff, setDiff] = useState<number | null>(null);
  useEffect(() => {
    setDiff(target.getTime() - Date.now());
    const t = setInterval(() => setDiff(target.getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (diff === null || diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
}

// ─── Smart assign players to formation ───────────────────────────────────────

function assignToFormation(players: SquadPlayer[], formation: string): { starters: SquadPlayer[]; bench: SquadPlayer[] } {
  const slots = getFormationSlots(formation);
  const byPos: Record<PosType, SquadPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of players) byPos[p.position].push(p);

  // Sort each position group by gwPoints desc
  for (const pos of Object.keys(byPos) as PosType[]) {
    byPos[pos].sort((a, b) => b.gwPoints - a.gwPoints);
  }

  const starters: SquadPlayer[] = [];
  for (const slot of slots) {
    const pool = byPos[slot.pos];
    if (pool.length > 0) {
      starters.push(pool.shift()!);
    } else {
      // Take best remaining player from any pos
      const fallback = (["FWD","MID","DEF","GK"] as PosType[])
        .map(p => byPos[p]).find(arr => arr.length > 0);
      if (fallback) starters.push(fallback.shift()!);
    }
  }

  const bench = Object.values(byPos).flat();
  return { starters, bench };
}

// ─── Player Card on Pitch ─────────────────────────────────────────────────────

interface PlayerCardProps {
  player: SquadPlayer;
  selected: boolean;
  swapMode: boolean;
  onClick: () => void;
  cardWidth: number;
}

function PlayerCard({ player, selected, swapMode, onClick, cardWidth }: PlayerCardProps) {
  const pm = POS_COLORS[player.position];
  const clubColor = CLUB_COLORS[player.club] ?? "#555";

  return (
    <div
      onClick={onClick}
      style={{
        width: cardWidth,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        transform: selected ? "scale(1.08)" : "scale(1)",
        transition: "transform 0.15s",
        filter: swapMode && !selected ? "brightness(0.7)" : "none",
      }}
    >
      {/* Avatar circle */}
      <div style={{
        width: cardWidth - 4,
        height: cardWidth - 4,
        borderRadius: "50%",
        background: clubColor,
        border: selected ? `3px solid #FF5A1F` : `2px solid rgba(255,255,255,0.5)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, position: "relative",
        boxShadow: selected ? "0 0 0 2px rgba(255,90,31,0.4)" : "0 2px 8px rgba(0,0,0,0.35)",
      }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: cardWidth * 0.28, color: "white", fontWeight: 700 }}>
          {player.club.slice(0, 3)}
        </span>
        {/* Captain/VC badge */}
        {(player.isCaptain || player.isVC) && (
          <div style={{
            position: "absolute", top: -4, right: -4,
            width: 16, height: 16, borderRadius: "50%",
            background: player.isCaptain ? "#FF5A1F" : "#9333EA",
            border: "2px solid rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'DM Mono', monospace", fontSize: 8, color: "white", fontWeight: 700,
          }}>
            {player.isCaptain ? "C" : "V"}
          </div>
        )}
      </div>
      {/* Name chip */}
      <div style={{
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        borderRadius: 4,
        padding: "2px 5px",
        textAlign: "center",
        maxWidth: cardWidth + 8,
        border: selected ? "1px solid #FF5A1F" : "1px solid rgba(255,255,255,0.15)",
      }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: Math.max(cardWidth * 0.22, 9), fontWeight: 600, color: "white", lineHeight: 1.2, whiteSpace: "nowrap" }}>
          {shortName(player.name)}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
          <span style={{ background: pm.bg, color: pm.text, fontFamily: "'DM Mono', monospace", fontSize: 7, borderRadius: 3, padding: "0px 3px" }}>
            {player.position}
          </span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: Math.max(cardWidth * 0.22, 9), fontWeight: 700, color: player.gwPoints > 0 ? "#FF5A1F" : "rgba(255,255,255,0.5)" }}>
            {player.gwPoints.toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const isMobile = useIsMobile();

  const lockoutDate = getNextLockout();
  const countdown = useCountdown(lockoutDate);
  const isLocked = !countdown;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myTeamName, setMyTeamName] = useState("");
  const [allPlayers, setAllPlayers] = useState<SquadPlayer[]>([]);
  const [formation, setFormation] = useState("4-3-3");
  const [starters, setStarters] = useState<SquadPlayer[]>([]);
  const [bench, setBench] = useState<SquadPlayer[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [vcId, setVcId] = useState<string | null>(null);

  // Selection / swap state
  const [selectedArea, setSelectedArea] = useState<"starter" | "bench" | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [actionPlayer, setActionPlayer] = useState<SquadPlayer | null>(null);

  const navLinks = [
    { label: "Home",     href: "/" },
    { label: "My Team",  href: `/leagues/${leagueId}/team` },
    { label: "Draft",    href: `/leagues/${leagueId}/draft` },
    { label: "Scoring",  href: `/leagues/${leagueId}/scoring` },
    { label: "Live",     href: `/leagues/${leagueId}/live` },
    { label: "Stats",    href: `/leagues/${leagueId}/table` },
    { label: "Waivers",  href: `/leagues/${leagueId}/waivers` },
    { label: "Trades",   href: `/leagues/${leagueId}/trades` },
    { label: "Chat",     href: `/leagues/${leagueId}/chat` },
    { label: "Messages", href: `/leagues/${leagueId}/messages` },
  ];

  // Load squad
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: league } = await supabase.from("leagues").select("name").eq("id", leagueId).single();
      if (league) setLeagueName(league.name);

      const { data: team } = await supabase
        .from("teams")
        .select("id, name, formation")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .single();

      if (!team) { setLoading(false); return; }
      setMyTeamId(team.id);
      setMyTeamName(team.name);
      const f = (team as unknown as { formation?: string }).formation ?? "4-3-3";
      setFormation(f);

      const { data: squadData } = await supabase
        .from("squad_players")
        .select("id, player_id, is_starting, bench_order, is_captain, is_vice_captain, player:players(name, club, position, gw_points)")
        .eq("team_id", team.id);

      if (!squadData?.length) { setLoading(false); return; }

      type Raw = {
        id: string; player_id: string; is_starting: boolean; bench_order: number | null;
        is_captain: boolean; is_vice_captain: boolean;
        player: { name: string; club: string; position: string; gw_points: number };
      };

      const mapped = (squadData as unknown as Raw[]).map(r => ({
        squadId: r.id,
        playerId: r.player_id,
        name: r.player?.name ?? "",
        shortName: shortName(r.player?.name ?? ""),
        club: r.player?.club ?? "",
        position: (r.player?.position ?? "FWD") as PosType,
        gwPoints: r.player?.gw_points ?? 0,
        isCaptain: r.is_captain ?? false,
        isVC: r.is_vice_captain ?? false,
        isStarting: r.is_starting,
        benchOrder: r.bench_order,
      }));

      setAllPlayers(mapped);
      const cap = mapped.find(p => p.isCaptain);
      const vc = mapped.find(p => p.isVC);
      if (cap) setCaptainId(cap.playerId);
      if (vc) setVcId(vc.playerId);

      // Split into starters / bench respecting saved order
      const savedStarters = mapped
        .filter(p => p.isStarting)
        .sort((a, b) => (a.benchOrder ?? 0) - (b.benchOrder ?? 0));
      const savedBench = mapped
        .filter(p => !p.isStarting)
        .sort((a, b) => (a.benchOrder ?? 99) - (b.benchOrder ?? 99));

      if (savedStarters.length === 11) {
        setStarters(savedStarters);
        setBench(savedBench);
      } else {
        const { starters: s, bench: b } = assignToFormation(mapped, f);
        setStarters(s);
        setBench(b);
      }
      setLoading(false);
    }
    load();
  }, [leagueId]);

  // When formation changes, reassign players
  const handleFormationChange = useCallback((f: string) => {
    setFormation(f);
    const all = [...starters, ...bench];
    const { starters: s, bench: b } = assignToFormation(all, f);
    setStarters(s);
    setBench(b);
    setSelectedIdx(null);
    setSelectedArea(null);
    setSwapMode(false);
    setActionPlayer(null);
  }, [starters, bench]);

  // Tap a player card
  function handleTap(area: "starter" | "bench", idx: number) {
    const player = area === "starter" ? starters[idx] : bench[idx];
    if (!player) return;

    if (swapMode && selectedIdx !== null && selectedArea !== null) {
      // Perform swap
      if (area === selectedArea && idx === selectedIdx) {
        // Tap same player — cancel
        setSwapMode(false);
        setSelectedIdx(null);
        setSelectedArea(null);
        setActionPlayer(null);
        return;
      }
      performSwap(selectedArea, selectedIdx, area, idx);
      setSwapMode(false);
      setSelectedIdx(null);
      setSelectedArea(null);
      setActionPlayer(null);
      return;
    }

    // Normal tap — show action panel
    setSelectedArea(area);
    setSelectedIdx(idx);
    setActionPlayer(player);
    setSwapMode(false);
  }

  function performSwap(areaA: "starter" | "bench", idxA: number, areaB: "starter" | "bench", idxB: number) {
    const newStarters = [...starters];
    const newBench = [...bench];

    if (areaA === "starter" && areaB === "starter") {
      [newStarters[idxA], newStarters[idxB]] = [newStarters[idxB], newStarters[idxA]];
    } else if (areaA === "bench" && areaB === "bench") {
      [newBench[idxA], newBench[idxB]] = [newBench[idxB], newBench[idxA]];
    } else {
      const [sIdx, bIdx] = areaA === "starter" ? [idxA, idxB] : [idxB, idxA];
      [newStarters[sIdx], newBench[bIdx]] = [newBench[bIdx], newStarters[sIdx]];
    }
    setStarters(newStarters);
    setBench(newBench);
  }

  function handleSetCaptain() {
    if (!actionPlayer) return;
    setCaptainId(actionPlayer.playerId);
    if (vcId === actionPlayer.playerId) setVcId(null);
    dismissAction();
  }

  function handleSetVC() {
    if (!actionPlayer) return;
    setVcId(actionPlayer.playerId);
    if (captainId === actionPlayer.playerId) setCaptainId(null);
    dismissAction();
  }

  function handleSwap() {
    setSwapMode(true);
    setActionPlayer(null);
  }

  function dismissAction() {
    setActionPlayer(null);
    setSelectedIdx(null);
    setSelectedArea(null);
    setSwapMode(false);
  }

  async function saveLineup() {
    if (!myTeamId || isLocked) return;
    setSaving(true);
    setSaveMsg(null);
    const supabase = createClient();

    // Update formation on team
    await supabase.from("teams").update({ formation } as Record<string, unknown>).eq("id", myTeamId);

    // Build updates for each squad player
    const updates = [
      ...starters.map((p, i) => ({
        id: p.squadId,
        is_starting: true,
        bench_order: i,
        is_captain: p.playerId === captainId,
        is_vice_captain: p.playerId === vcId,
      })),
      ...bench.map((p, i) => ({
        id: p.squadId,
        is_starting: false,
        bench_order: i + 1,
        is_captain: false,
        is_vice_captain: false,
      })),
    ];

    const { error } = await supabase.from("squad_players").upsert(updates);
    setSaving(false);
    if (error) {
      setSaveMsg(`Error: ${error.message}`);
    } else {
      setSaveMsg("Lineup saved!");
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const slots = getFormationSlots(formation);
  const pitchCardWidth = isMobile ? 40 : 50;

  const startersWithCaptain = starters.map(p => ({
    ...p,
    isCaptain: p.playerId === captainId,
    isVC: p.playerId === vcId,
  }));

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--c-text-dim)", letterSpacing: "0.12em" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .formation-btn {
          padding: 7px 14px; border-radius: 8px;
          border: 1.5px solid var(--c-border-strong);
          background: transparent; color: var(--c-text-muted);
          font-family: 'DM Mono', monospace; font-size: 11px;
          letter-spacing: 0.06em; cursor: pointer; white-space: nowrap;
          transition: all 0.15s;
        }
        .formation-btn:hover { border-color: #FF5A1F; color: #FF5A1F; }
        .formation-btn.active { background: #FF5A1F; border-color: #FF5A1F; color: white; }
        .action-btn {
          flex: 1; padding: 12px 8px; border-radius: 10px;
          border: 1.5px solid var(--c-border-strong);
          background: var(--c-bg-elevated); color: var(--c-text);
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.06em; cursor: pointer; text-align: center;
          transition: all 0.15s;
        }
        .action-btn:hover { border-color: #FF5A1F; color: #FF5A1F; }
        .action-btn.captain { background: rgba(255,90,31,0.1); border-color: #FF5A1F; color: #FF5A1F; }
        .action-btn.vc { background: rgba(147,51,234,0.1); border-color: #9333ea; color: #9333ea; }
      `}</style>

      <NavBar links={navLinks} activeLabel="My Team" right={<ThemeToggle size="sm" />} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 12px" : "32px 40px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF5A1F", marginBottom: 4 }}>
              {leagueName}
            </p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 24 : 30, fontWeight: 900, letterSpacing: "-0.02em" }}>
              {myTeamName || "My Team"}
            </h1>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {countdown && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-dim)", letterSpacing: "0.04em" }}>
                Locks in <span style={{ color: "#FF5A1F" }}>{countdown}</span>
              </div>
            )}
            {isLocked && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#DC2626", letterSpacing: "0.08em" }}>
                🔒 LOCKED
              </div>
            )}
            <button
              onClick={saveLineup}
              disabled={saving || isLocked || !myTeamId}
              style={{
                padding: "10px 24px", borderRadius: 10,
                background: isLocked ? "var(--c-skeleton)" : "#FF5A1F",
                color: "white", border: "none",
                fontFamily: "'DM Mono', monospace", fontSize: 11,
                letterSpacing: "0.08em", cursor: isLocked ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1, minHeight: 44,
              }}
            >
              {saving ? "Saving…" : saveMsg ?? "Save Lineup"}
            </button>
          </div>
        </div>

        {/* Formation selector */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
          {Object.keys(FORMATIONS).map(f => (
            <button
              key={f}
              className={`formation-btn${formation === f ? " active" : ""}`}
              onClick={() => handleFormationChange(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Empty squad state */}
        {starters.length === 0 && (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--c-text-dim)", marginBottom: 12 }}>No squad yet</p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--c-text-dim)" }}>
              Complete the draft to manage your lineup.
            </p>
          </div>
        )}

        {starters.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 260px", gap: 16 }}>

            {/* ── LEFT: Pitch + bench ── */}
            <div>

              {/* Action panel */}
              {actionPlayer && !swapMode && (
                <div style={{
                  background: "var(--c-bg-elevated)",
                  border: "1.5px solid var(--c-border-strong)",
                  borderRadius: 12, padding: "12px 16px",
                  marginBottom: 12, animation: "fadeIn 0.14s ease",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: CLUB_COLORS[actionPlayer.club] ?? "#555",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'DM Mono', monospace", fontSize: 10, color: "white", fontWeight: 700,
                    }}>{actionPlayer.club.slice(0,3)}</div>
                    <div>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{actionPlayer.name}</p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-muted)" }}>
                        {actionPlayer.position} · {actionPlayer.club} · {actionPlayer.gwPoints.toFixed(1)} pts
                      </p>
                    </div>
                    <button onClick={dismissAction} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", fontSize: 16, padding: 4 }}>✕</button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={`action-btn${captainId === actionPlayer.playerId ? " captain" : ""}`} onClick={handleSetCaptain}>
                      C · Captain{captainId === actionPlayer.playerId ? " ✓" : ""}
                    </button>
                    <button className={`action-btn${vcId === actionPlayer.playerId ? " vc" : ""}`} onClick={handleSetVC}>
                      VC · Vice Capt{vcId === actionPlayer.playerId ? " ✓" : ""}
                    </button>
                    <button className="action-btn" onClick={handleSwap}>
                      ↕ Swap
                    </button>
                  </div>
                </div>
              )}

              {swapMode && (
                <div style={{
                  background: "rgba(255,90,31,0.08)",
                  border: "1.5px solid rgba(255,90,31,0.3)",
                  borderRadius: 10, padding: "10px 14px",
                  marginBottom: 12, fontFamily: "'DM Mono', monospace", fontSize: 11,
                  color: "#FF5A1F", letterSpacing: "0.06em",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>Tap another player to swap with {actionPlayer ? shortName(actionPlayer.name) : "selected"}</span>
                  <button onClick={dismissAction} style={{ background: "none", border: "none", cursor: "pointer", color: "#FF5A1F", fontSize: 14 }}>✕</button>
                </div>
              )}

              {/* Pitch */}
              <div style={{
                position: "relative",
                background: "linear-gradient(180deg, #1b5e20 0%, #2e7d32 18%, #388e3c 50%, #2e7d32 82%, #1b5e20 100%)",
                borderRadius: 12,
                overflow: "hidden",
                width: "100%",
                aspectRatio: "0.66",
                border: "3px solid #1b5e20",
                boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
              }}>
                {/* Pitch markings */}
                <div style={{ position: "absolute", inset: "3%", border: "2px solid rgba(255,255,255,0.45)", borderRadius: 2, pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: "50%", left: "3%", right: "3%", height: 2, background: "rgba(255,255,255,0.4)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "20%", aspectRatio: 1, border: "2px solid rgba(255,255,255,0.4)", borderRadius: "50%", pointerEvents: "none" }} />
                {/* Top penalty box */}
                <div style={{ position: "absolute", top: "3%", left: "24%", right: "24%", height: "16%", border: "2px solid rgba(255,255,255,0.35)", borderTop: "none", pointerEvents: "none" }} />
                {/* Bottom penalty box */}
                <div style={{ position: "absolute", bottom: "3%", left: "24%", right: "24%", height: "16%", border: "2px solid rgba(255,255,255,0.35)", borderBottom: "none", pointerEvents: "none" }} />
                {/* Center spot */}
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.5)", pointerEvents: "none" }} />

                {/* Player cards */}
                {slots.map((slot, i) => {
                  const player = startersWithCaptain[i];
                  if (!player) return null;
                  const isSelected = selectedArea === "starter" && selectedIdx === i;
                  return (
                    <div
                      key={slot.idx}
                      style={{
                        position: "absolute",
                        left: `${slot.x}%`,
                        top: `${slot.y}%`,
                        transform: "translate(-50%, -50%)",
                        zIndex: isSelected ? 10 : 1,
                      }}
                    >
                      <PlayerCard
                        player={player}
                        selected={isSelected}
                        swapMode={swapMode}
                        onClick={() => handleTap("starter", i)}
                        cardWidth={pitchCardWidth}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Bench */}
              <div style={{ marginTop: 12 }}>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 8 }}>
                  Bench — tap to swap with a starter
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  {bench.map((player, i) => {
                    const isSelected = selectedArea === "bench" && selectedIdx === i;
                    return (
                      <div
                        key={player.squadId}
                        onClick={() => handleTap("bench", i)}
                        style={{
                          flex: 1, background: "var(--c-bg-elevated)",
                          border: isSelected ? "2px solid #FF5A1F" : "1.5px solid var(--c-border-strong)",
                          borderRadius: 10, padding: "10px 6px",
                          cursor: "pointer", textAlign: "center",
                          transition: "border-color 0.15s",
                          opacity: 0.85,
                          transform: isSelected ? "scale(1.05)" : "scale(1)",
                        }}
                      >
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#FF5A1F", marginBottom: 4 }}>
                          Sub {i + 1}
                        </div>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: CLUB_COLORS[player.club] ?? "#555",
                          margin: "0 auto 4px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "'DM Mono', monospace", fontSize: 8, color: "white", fontWeight: 700,
                        }}>{player.club.slice(0,3)}</div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, color: "var(--c-text)", lineHeight: 1.2 }}>
                          {shortName(player.name)}
                        </div>
                        <div style={{
                          display: "inline-block", marginTop: 3,
                          background: POS_COLORS[player.position].bg,
                          color: POS_COLORS[player.position].text,
                          fontFamily: "'DM Mono', monospace", fontSize: 7,
                          borderRadius: 3, padding: "1px 4px",
                        }}>{player.position}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── RIGHT: Info panel ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Captain / VC summary */}
              <div style={{ background: "var(--c-bg-elevated)", borderRadius: 12, border: "1.5px solid var(--c-border-strong)", padding: "14px 16px" }}>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 10 }}>Armband</p>
                {[
                  { label: "C", name: "Captain", playerId: captainId, color: "#FF5A1F" },
                  { label: "V", name: "Vice Captain", playerId: vcId, color: "#9333EA" },
                ].map(({ label, name, playerId, color }) => {
                  const p = allPlayers.find(x => x.playerId === playerId);
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: label === "C" ? "1px solid var(--c-border)" : "none" }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "white", fontWeight: 700, flexShrink: 0 }}>
                        {label}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 1 }}>{name}</p>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: p ? "var(--c-text)" : "var(--c-text-muted)" }}>
                          {p ? p.name : "Not set"}
                        </p>
                      </div>
                      {p && (
                        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color }}>
                          {(p.gwPoints * (label === "C" ? 2 : 1)).toFixed(0)}
                        </span>
                      )}
                    </div>
                  );
                })}
                {!captainId && (
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", marginTop: 8, lineHeight: 1.5 }}>
                    Tap a player on the pitch, then "Captain" to assign. Captain gets 2× points.
                  </p>
                )}
              </div>

              {/* Formation stats */}
              <div style={{ background: "var(--c-bg-elevated)", borderRadius: 12, border: "1.5px solid var(--c-border-strong)", padding: "14px 16px" }}>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 10 }}>Formation</p>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#FF5A1F", lineHeight: 1 }}>{formation}</p>
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  {(["GK","DEF","MID","FWD"] as PosType[]).map(pos => {
                    const count = starters.filter(p => p.position === pos).length;
                    return (
                      <div key={pos} style={{ textAlign: "center" }}>
                        <div style={{
                          background: POS_COLORS[pos].bg, color: POS_COLORS[pos].text,
                          fontFamily: "'DM Mono', monospace", fontSize: 8,
                          borderRadius: 4, padding: "2px 6px", marginBottom: 2,
                        }}>{pos}</div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--c-text)" }}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GW projected */}
              <div style={{ background: "var(--c-bg-elevated)", borderRadius: 12, border: "1.5px solid var(--c-border-strong)", padding: "14px 16px" }}>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 10 }}>Projected GW Pts</p>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "var(--c-text)", lineHeight: 1 }}>
                  {starters.reduce((s, p) => {
                    const pts = p.gwPoints * (p.playerId === captainId ? 2 : 1);
                    return s + pts;
                  }, 0).toFixed(1)}
                </p>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", marginTop: 4 }}>Based on last GW points</p>
              </div>

              {/* Starters list */}
              <div style={{ background: "var(--c-bg-elevated)", borderRadius: 12, border: "1.5px solid var(--c-border-strong)", overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--c-border)" }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)" }}>Starting XI</p>
                </div>
                {startersWithCaptain.map((p, i) => (
                  <div
                    key={p.squadId}
                    onClick={() => handleTap("starter", i)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 14px",
                      borderBottom: i < starters.length - 1 ? "1px solid var(--c-border)" : "none",
                      cursor: "pointer",
                      background: selectedArea === "starter" && selectedIdx === i ? "var(--c-row-active)" : "transparent",
                      transition: "background 0.12s",
                    }}
                  >
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: CLUB_COLORS[p.club] ?? "#555", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    {p.isCaptain && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, background: "#FF5A1F", color: "white", borderRadius: 3, padding: "1px 5px" }}>C</span>}
                    {p.isVC && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, background: "#9333EA", color: "white", borderRadius: 3, padding: "1px 5px" }}>VC</span>}
                    <div style={{ background: POS_COLORS[p.position].bg, color: POS_COLORS[p.position].text, fontFamily: "'DM Mono', monospace", fontSize: 7, borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>{p.position}</div>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: p.gwPoints > 0 ? "#FF5A1F" : "var(--c-text-muted)", minWidth: 28, textAlign: "right", flexShrink: 0 }}>{p.gwPoints.toFixed(0)}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
