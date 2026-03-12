"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useTheme } from "@/lib/theme-context";
import { useIsMobile } from "@/lib/use-is-mobile";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Player = {
  id: string;
  name: string;
  club: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  api_rank: number | null;
  season_points: number;
};

type Team = {
  id: string;
  name: string;
  isUser: boolean;
  draftPosition: number;
  picks: Player[];
};

type PickRecord = { pickNum: number; teamId: string; player: Player };
type Phase = "setup" | "draft" | "complete";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const SQUAD_SIZE = 15;
const PICK_SECONDS = 30;
const POSITION_TARGETS: Record<string, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

const BOT_NAMES = [
  "Algorithm FC", "CPU United", "Bot City Rovers", "The Autopickers",
  "Neural FC", "Data Drive FC", "Matrix City", "Silicon Athletic",
  "Binary Stars", "Recursive FC", "Null Pointer FC", "Overflow United",
];

const POS_META: Record<string, { color: string; bg: string; border: string }> = {
  GK:  { color: "#92400E", bg: "#FEF9C3", border: "#FDE68A" },
  DEF: { color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  MID: { color: "#6B21A8", bg: "#F3E8FF", border: "#E9D5FF" },
  FWD: { color: "#C2410C", bg: "#FFF1EC", border: "#FED7AA" },
};

const CLUB_COLORS: Record<string, string> = {
  LIV: "#C8102E", ARS: "#EF0107", MCI: "#6CABDD", CHE: "#034694",
  AVL: "#670E36", BRE: "#E30613", TOT: "#132257", EVE: "#003399",
  NEW: "#241F20", FUL: "#CC0000", MUN: "#DA291C", BOU: "#B50E12",
  WHU: "#7A263A", WOL: "#FDB913", BHA: "#0057B8", NFO: "#E53233",
  SUN: "#EB172B", LEE: "#FFCD00", BUR: "#6C1D45", CRY: "#1B458F",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Returns 0-indexed position in the teams array for a given absolute pick number */
function snakeTeamIndex(pickNum: number, numTeams: number): number {
  const round = Math.ceil(pickNum / numTeams);
  const posInRound = (pickNum - 1) % numTeams;
  return round % 2 === 0 ? numTeams - 1 - posInRound : posInRound;
}

/** Returns the absolute pick number for team at 1-indexed draftPosition in a given round */
function pickNumForCell(round: number, draftPos: number, numTeams: number): number {
  return round % 2 === 0
    ? (round - 1) * numTeams + (numTeams + 1 - draftPos)
    : (round - 1) * numTeams + draftPos;
}

function botPickPlayer(team: Team, available: Player[]): Player | null {
  const posCounts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of team.picks) posCounts[p.position]++;

  const remaining = SQUAD_SIZE - team.picks.length;
  // Work out if any position is critical (must pick now or won't fill it)
  const otherNeeded = (pos: string) =>
    Object.entries(POSITION_TARGETS)
      .filter(([p]) => p !== pos)
      .reduce((sum, [p, t]) => sum + Math.max(0, t - posCounts[p]), 0);

  const critical = Object.keys(POSITION_TARGETS).filter(pos => {
    const needed = POSITION_TARGETS[pos] - posCounts[pos];
    return needed > 0 && needed >= remaining - otherNeeded(pos);
  });

  const poolByPos = critical.length > 0
    ? available.filter(p => critical.includes(p.position))
    : available.filter(p => posCounts[p.position] < POSITION_TARGETS[p.position]);

  const pool = poolByPos.length > 0 ? poolByPos : available;
  return [...pool].sort((a, b) => b.season_points - a.season_points)[0] ?? null;
}

function calcRating(myTeam: Team, allTeams: Team[]): number {
  const pts = (t: Team) => t.picks.reduce((s, p) => s + p.season_points, 0);
  const myPts = pts(myTeam);
  const allPts = allTeams.map(pts);
  const max = Math.max(...allPts), min = Math.min(...allPts);
  if (max === min) return 6.5;
  return Math.round(Math.min(10, Math.max(1, 3 + 7 * (myPts - min) / (max - min))) * 10) / 10;
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function PosChip({ pos }: { pos: string }) {
  const m = POS_META[pos] ?? { color: "#555", bg: "#eee", border: "#ccc" };
  return (
    <span style={{
      padding: "2px 6px", borderRadius: 4, fontSize: 10,
      fontFamily: "'DM Mono', monospace", fontWeight: 600, letterSpacing: "0.06em",
      color: m.color, background: m.bg, border: `1px solid ${m.border}`, flexShrink: 0,
    }}>{pos}</span>
  );
}

function ClubBadge({ club, size = 22 }: { club: string; size?: number }) {
  const color = CLUB_COLORS[club] ?? "#555";
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, background: color,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ color: club === "LEE" ? "#1D428A" : "white", fontSize: size * 0.42, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
        {club[0]}
      </span>
    </div>
  );
}

function MockBadge({ inline }: { inline?: boolean }) {
  return (
    <div style={{
      background: inline ? "rgba(255,90,31,0.12)" : "repeating-linear-gradient(45deg,#1a0900,#1a0900 8px,#261200 8px,#261200 16px)",
      border: `${inline ? "1" : "2"}px solid ${inline ? "rgba(255,90,31,0.45)" : "#FF5A1F"}`,
      borderRadius: inline ? 6 : 10,
      padding: inline ? "4px 12px" : "10px 24px",
      display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
    }}>
      {!inline && <span style={{ fontSize: 15 }}>⚠️</span>}
      <div style={{ textAlign: inline ? undefined : "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: inline ? 10 : 11, fontWeight: 700, letterSpacing: "0.14em", color: "#FF5A1F" }}>
          {inline ? "⚠ MOCK DRAFT" : "⚠  MOCK DRAFT  ⚠"}
        </div>
        {!inline && (
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", color: "#8B5E3C", marginTop: 2 }}>
            Practice Mode — Nothing is saved to your account
          </div>
        )}
      </div>
      {!inline && <span style={{ fontSize: 15 }}>⚠️</span>}
    </div>
  );
}

function PickTimer({ seconds, total }: { seconds: number; total: number }) {
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const color = seconds <= 10 ? "#DC2626" : seconds <= 20 ? "#D97706" : "#FF5A1F";
  const r = 18;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
      <svg width="44" height="44" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={`${circ * (1 - pct / 100)}`}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
        color: seconds <= 10 ? color : "white",
      }}>{seconds}</div>
    </div>
  );
}

// ─── SETUP SCREEN ─────────────────────────────────────────────────────────────

function ConfirmModal({ onConfirm, onBack }: { onConfirm: () => void; onBack: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      backdropFilter: "blur(4px)",
    }}
      onClick={onBack}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440,
          background: "#16110C",
          border: "2px solid #FF5A1F",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 0 60px rgba(255,90,31,0.25)",
        }}
      >
        {/* Orange top band */}
        <div style={{
          background: "repeating-linear-gradient(45deg,#2a1000,#2a1000 10px,#331400 10px,#331400 20px)",
          borderBottom: "1px solid rgba(255,90,31,0.4)",
          padding: "14px 24px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: "#FF5A1F" }}>
            ⚠  MOCK DRAFT  ⚠
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#8B5E3C", letterSpacing: "0.08em" }}>
            PRACTICE MODE
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "32px 28px 28px" }}>
          <div style={{ fontSize: 32, marginBottom: 12, lineHeight: 1 }}>🎯</div>
          <h2 style={{
            fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900,
            margin: "0 0 14px", color: "#F5F0E8", lineHeight: 1.2,
          }}>This is a Mock Draft</h2>

          <p style={{ fontSize: 14, color: "#9A8878", lineHeight: 1.65, margin: "0 0 24px" }}>
            Nothing here is saved. No real picks are made. This is purely for practice so you can
            get comfortable with the draft before the real thing.
          </p>

          {/* Bullet points */}
          <div style={{
            background: "rgba(255,90,31,0.07)",
            border: "1px solid rgba(255,90,31,0.2)",
            borderRadius: 10,
            padding: "16px 18px",
            marginBottom: 28,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {[
              "Your picks won't be saved to your account",
              "Won't affect your real leagues in any way",
              "You can quit anytime and start over",
            ].map(text => (
              <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ color: "#22C55E", fontSize: 14, lineHeight: 1.5, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: "#C9B99A", lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Proceed button */}
          <button onClick={onConfirm} style={{
            width: "100%", padding: "15px 0", borderRadius: 10, border: "none",
            background: "#FF5A1F", color: "white",
            fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
            letterSpacing: "0.12em", cursor: "pointer",
            marginBottom: 14,
          }}>
            LET'S PRACTICE →
          </button>

          {/* Go back */}
          <div style={{ textAlign: "center" }}>
            <button onClick={onBack} style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'DM Mono', monospace", fontSize: 10,
              color: "#6B5244", letterSpacing: "0.08em",
              textDecoration: "underline", textUnderlineOffset: 3,
            }}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupScreen({
  numTeams, setNumTeams, draftPosition, setDraftPosition,
  onStart, loadingPlayers,
}: {
  numTeams: number; setNumTeams: (n: number) => void;
  draftPosition: number; setDraftPosition: (p: number) => void;
  onStart: () => void; loadingPlayers: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#0F0D0B", color: "#F5F0E8", fontFamily: "'DM Sans', sans-serif" }}>
      {showConfirm && <ConfirmModal onConfirm={onStart} onBack={() => setShowConfirm(false)} />}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px", height: 52, display: "flex", alignItems: "center" }}>
        <Link href="/" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 18, color: "#FF5A1F", textDecoration: "none" }}>CURTIS</Link>
        <div style={{ flex: 1 }} />
        <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#8B7355", letterSpacing: "0.08em", textDecoration: "none" }}>← Back to Hub</Link>
      </nav>

      <div style={{ maxWidth: "min(500px, 100%)", margin: "40px auto", padding: "0 16px" }}>
        {/* Centred badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
          <MockBadge />
        </div>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 900, textAlign: "center", margin: "0 0 10px" }}>Practice Your Draft</h1>
        <p style={{ color: "#8B7355", textAlign: "center", fontSize: 14, lineHeight: 1.65, marginBottom: 44 }}>
          Run a full mock draft against AI bots before your real league starts.<br />
          Try different positions, build shortlists, dial in your strategy.
        </p>

        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 28, display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Number of teams */}
          <div>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "#8B7355", display: "block", marginBottom: 12 }}>
              NUMBER OF TEAMS
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {[2,3,4,5,6,7,8].map(n => (
                <button key={n} onClick={() => { setNumTeams(n); if (draftPosition > n) setDraftPosition(1); }} style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer",
                  border: numTeams === n ? "2px solid #FF5A1F" : "1px solid rgba(255,255,255,0.1)",
                  background: numTeams === n ? "rgba(255,90,31,0.14)" : "rgba(255,255,255,0.03)",
                  color: numTeams === n ? "#FF5A1F" : "#C9B99A",
                  fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700,
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* Draft position */}
          <div>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "#8B7355", display: "block", marginBottom: 12 }}>
              YOUR DRAFT POSITION
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Array.from({ length: numTeams }, (_, i) => i + 1).map(pos => (
                <button key={pos} onClick={() => setDraftPosition(pos)} style={{
                  width: 46, height: 46, borderRadius: 8, cursor: "pointer",
                  border: draftPosition === pos ? "2px solid #FF5A1F" : "1px solid rgba(255,255,255,0.1)",
                  background: draftPosition === pos ? "rgba(255,90,31,0.14)" : "rgba(255,255,255,0.03)",
                  color: draftPosition === pos ? "#FF5A1F" : "#C9B99A",
                  fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700,
                }}>{pos}</button>
              ))}
            </div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4A3E34", marginTop: 8 }}>
              Pick 1 = first overall. Snake format — odd rounds go 1→{numTeams}, even rounds reverse.
            </p>
          </div>

          {/* Squad info */}
          <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#8B7355", marginBottom: 10 }}>SQUAD — 15 PLAYERS</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["GK","DEF","MID","FWD"] as const).map(pos => (
                <div key={pos} style={{ flex: 1, textAlign: "center" }}>
                  <PosChip pos={pos} />
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#F5F0E8", marginTop: 5 }}>×{POSITION_TARGETS[pos]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Timer note */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,90,31,0.06)", borderRadius: 8, border: "1px solid rgba(255,90,31,0.15)" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #FF5A1F", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "#FF5A1F", flexShrink: 0 }}>30</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#8B7355", lineHeight: 1.5 }}>
              30 seconds per pick. Bots pick instantly.<br />
              <span style={{ color: "#6B5244" }}>Starred players auto-pick if timer expires.</span>
            </div>
          </div>
        </div>

        <button onClick={() => !loadingPlayers && setShowConfirm(true)} disabled={loadingPlayers} style={{
          width: "100%", marginTop: 20, padding: "15px 0", borderRadius: 12, border: "none",
          background: loadingPlayers ? "#2A1F15" : "#FF5A1F",
          color: loadingPlayers ? "#4A3E34" : "white",
          fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
          letterSpacing: "0.12em", cursor: loadingPlayers ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}>
          {loadingPlayers ? "LOADING PLAYERS…" : "START MOCK DRAFT →"}
        </button>
      </div>
    </div>
  );
}

// ─── COMPLETE SCREEN ──────────────────────────────────────────────────────────

function CompleteScreen({ teams, onReset }: { teams: Team[]; onReset: () => void }) {
  const myTeam = teams.find(t => t.isUser)!;
  const projectedPts = myTeam.picks.reduce((s, p) => s + p.season_points, 0);
  const rating = calcRating(myTeam, teams);
  const ratingColor = rating >= 8 ? "#22C55E" : rating >= 6 ? "#FF5A1F" : "#F59E0B";

  const ratingLabel =
    rating >= 9 ? "Outstanding" :
    rating >= 8 ? "Excellent" :
    rating >= 7 ? "Strong" :
    rating >= 6 ? "Decent" :
    rating >= 5 ? "Average" : "Needs Work";

  const byPos = {
    GK:  myTeam.picks.filter(p => p.position === "GK"),
    DEF: myTeam.picks.filter(p => p.position === "DEF"),
    MID: myTeam.picks.filter(p => p.position === "MID"),
    FWD: myTeam.picks.filter(p => p.position === "FWD"),
  };

  const posLabel: Record<string, string> = { GK: "GOALKEEPERS", DEF: "DEFENDERS", MID: "MIDFIELDERS", FWD: "FORWARDS" };

  return (
    <div style={{ minHeight: "100vh", background: "#0F0D0B", color: "#F5F0E8", fontFamily: "'DM Sans', sans-serif" }}>
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px", height: 52, display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 18, color: "#FF5A1F", textDecoration: "none" }}>CURTIS</Link>
        <MockBadge inline />
        <div style={{ flex: 1 }} />
        <button onClick={onReset} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#8B7355", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", letterSpacing: "0.07em" }}>
          Try Again
        </button>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 6, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, margin: 0 }}>Mock Draft Complete</h1>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 52, fontWeight: 900, color: ratingColor, lineHeight: 1 }}>{rating}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: "#8B7355" }}>/10</span>
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: ratingColor, letterSpacing: "0.08em" }}>{ratingLabel}</div>
        </div>
        <p style={{ color: "#8B7355", fontSize: 14, marginBottom: 36 }}>
          Projected total: <strong style={{ color: "#F5F0E8" }}>{projectedPts.toFixed(0)} pts</strong> based on last season's data.
          Rating compares your haul to the other {teams.length - 1} teams in this mock.
        </p>

        {/* Bot results strip */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px", marginBottom: 32 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#8B7355", marginBottom: 10 }}>ALL TEAMS — PROJECTED PTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...teams]
              .sort((a, b) => b.picks.reduce((s, p) => s + p.season_points, 0) - a.picks.reduce((s, p) => s + p.season_points, 0))
              .map((t, i) => {
                const tPts = t.picks.reduce((s, p) => s + p.season_points, 0);
                const maxPts = teams.reduce((m, tt) => Math.max(m, tt.picks.reduce((s, p) => s + p.season_points, 0)), 0);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#4A3E34", minWidth: 16 }}>{i + 1}.</span>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        height: 6, borderRadius: 3,
                        background: t.isUser ? "#FF5A1F" : "rgba(255,255,255,0.12)",
                        width: `${(tPts / maxPts) * 100}%`,
                        transition: "width 0.6s ease",
                        minWidth: 4,
                      }} />
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, color: t.isUser ? "#FF5A1F" : "#8B7355", minWidth: 36, textAlign: "right" }}>{tPts.toFixed(0)}</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: t.isUser ? "#FF5A1F" : "#6B5244", minWidth: 120 }}>{t.isUser ? "YOU" : t.name}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Squad by position */}
        {(["GK","DEF","MID","FWD"] as const).map(pos => (
          <div key={pos} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: "#8B7355", marginBottom: 8 }}>{posLabel[pos]}</div>
            {byPos[pos].map(p => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, marginBottom: 5,
              }}>
                <ClubBadge club={p.club} size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#8B7355" }}>{p.club}</div>
                </div>
                <PosChip pos={p.position} />
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#FF5A1F", minWidth: 52, textAlign: "right" }}>
                  {p.season_points.toFixed(0)} pts
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* CTAs */}
        <div style={{ marginTop: 44, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/leagues/new" style={{
            flex: 2, padding: "15px 0", borderRadius: 12,
            background: "#FF5A1F", color: "white",
            fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
            letterSpacing: "0.12em", textDecoration: "none", display: "block", textAlign: "center",
          }}>DRAFT FOR REAL →</Link>
          <button onClick={onReset} style={{
            flex: 1, padding: "15px 0", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)",
            color: "#F5F0E8", fontFamily: "'DM Mono', monospace", fontSize: 12,
            fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer",
          }}>TRY AGAIN</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function MockDraftPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [numTeams, setNumTeams] = useState(6);
  const [draftPosition, setDraftPosition] = useState(3);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // Draft state — all picks, teams
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<PickRecord[]>([]);
  const [timer, setTimer] = useState(PICK_SECONDS);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState<"available" | "shortlist">("available");
  const [boardView, setBoardView] = useState<"board" | "list">("board");
  const [lastPick, setLastPick] = useState<{ player: Player; teamName: string } | null>(null);
  const [lastPickTimer, setLastPickTimer] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const lightMode = theme === "light";
  const [muted, setMuted] = useState(true);
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<"players" | "board" | "squad">("players");

  // Refs to avoid stale closures
  const teamsRef = useRef<Team[]>([]);
  const picksRef = useRef<PickRecord[]>([]);
  const playersRef = useRef<Player[]>([]);
  const shortlistRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const oscNodesRef = useRef<AudioNode[]>([]);
  const tickSchedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { teamsRef.current = teams; }, [teams]);
  useEffect(() => { picksRef.current = picks; }, [picks]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { shortlistRef.current = shortlist; }, [shortlist]);

  // Audio engine
  function startAudio() {
    if (audioCtxRef.current) return; // already running
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.22, ctx.currentTime);
    master.connect(ctx.destination);
    masterGainRef.current = master;

    const nodes: AudioNode[] = [];

    // ── Bass drone: A1 (55Hz) sine with slow pitch LFO
    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.setValueAtTime(55, ctx.currentTime);
    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.28, ctx.currentTime);
    const pitchLfo = ctx.createOscillator();
    pitchLfo.frequency.setValueAtTime(0.07, ctx.currentTime);
    const pitchLfoGain = ctx.createGain();
    pitchLfoGain.gain.setValueAtTime(2.5, ctx.currentTime);
    pitchLfo.connect(pitchLfoGain);
    pitchLfoGain.connect(drone.frequency);
    drone.connect(droneGain);
    droneGain.connect(master);
    drone.start(); pitchLfo.start();
    nodes.push(drone, droneGain, pitchLfo, pitchLfoGain);

    // ── Pad: Am chord (A2, C3, E3, A3) triangle waves with individual tremolo LFOs
    [110, 130.8, 164.8, 220].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.055, ctx.currentTime);
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.04 + i * 0.018, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.018, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      lfo.start(); osc.start();
      osc.connect(g); g.connect(master);
      nodes.push(osc, g, lfo, lfoGain);
    });

    oscNodesRef.current = nodes;

    // ── Ticking: lookahead scheduler, ~1 tick/second
    let nextTick = ctx.currentTime + 0.1;

    function scheduleOneTick(when: number) {
      const bufLen = Math.floor(ctx.sampleRate * 0.018);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.07));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hpf = ctx.createBiquadFilter();
      hpf.type = "highpass";
      hpf.frequency.setValueAtTime(1800, when);
      const tickGain = ctx.createGain();
      tickGain.gain.setValueAtTime(0.22, when);
      src.connect(hpf); hpf.connect(tickGain); tickGain.connect(master);
      src.start(when);
    }

    function loop() {
      while (nextTick < ctx.currentTime + 0.25) {
        scheduleOneTick(nextTick);
        nextTick += 0.90 + Math.random() * 0.20;
      }
      tickSchedulerRef.current = setTimeout(loop, 60);
    }
    loop();
  }

  function stopAudio() {
    if (tickSchedulerRef.current) clearTimeout(tickSchedulerRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
      masterGainRef.current = null;
      oscNodesRef.current = [];
    }
  }

  // Mute/unmute — create AudioContext lazily on first unmute
  useEffect(() => {
    if (!muted) {
      startAudio();
      masterGainRef.current?.gain.setTargetAtTime(0.22, audioCtxRef.current!.currentTime, 0.1);
    } else {
      masterGainRef.current?.gain.setTargetAtTime(0, audioCtxRef.current?.currentTime ?? 0, 0.1);
    }
  }, [muted]);

  // Stop audio on unmount or phase change away from draft
  useEffect(() => {
    return () => stopAudio();
  }, []);

  // Derived
  const currentPickNum = picks.length + 1;
  const totalDraftPicks = numTeams * SQUAD_SIZE;
  const isDraftComplete = picks.length >= totalDraftPicks;
  const pickedIds = new Set(picks.map(p => p.player.id));
  const available = players.filter(p => !pickedIds.has(p.id));
  const myTeam = teams.find(t => t.isUser) ?? null;
  const currentPickingTeam = !isDraftComplete && teams.length > 0 ? teams[snakeTeamIndex(currentPickNum, numTeams)] : null;
  const isMyTurn = currentPickingTeam?.isUser ?? false;
  const currentRound = numTeams > 0 ? Math.ceil(currentPickNum / numTeams) : 1;

  const filteredAvailable = available
    .filter(p => posFilter === "ALL" || p.position === posFilter)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.club.toLowerCase().includes(search.toLowerCase()));

  const shortlistedAvailable = available.filter(p => shortlist.includes(p.id));
  const displayPlayers = activeTab === "shortlist" ? shortlistedAvailable : filteredAvailable;

  // Load players from Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("players")
      .select("id, name, club, position, api_rank, season_points")
      .eq("is_available", true)
      .order("season_points", { ascending: false })
      .then(({ data }) => {
        const list = data && data.length >= 80 ? data : FALLBACK_PLAYERS;
        setPlayers(list as Player[]);
        playersRef.current = list as Player[];
        setLoadingPlayers(false);
      });
  }, []);

  // ── Core pick function
  const makePick = useCallback((player: Player, pickNum: number) => {
    const currentTeams = teamsRef.current;
    const pickingTeam = currentTeams[snakeTeamIndex(pickNum, currentTeams.length)];
    if (!pickingTeam) return;

    const newRecord: PickRecord = { pickNum, teamId: pickingTeam.id, player };
    picksRef.current = [...picksRef.current, newRecord];
    setPicks(prev => [...prev, newRecord]);

    teamsRef.current = teamsRef.current.map(t =>
      t.id === pickingTeam.id ? { ...t, picks: [...t.picks, player] } : t
    );
    setTeams(prev => prev.map(t =>
      t.id === pickingTeam.id ? { ...t, picks: [...t.picks, player] } : t
    ));

    setLastPick({ player, teamName: pickingTeam.isUser ? "You" : pickingTeam.name });
    setLastPickTimer(4);

    if (pickNum >= teamsRef.current.length * SQUAD_SIZE) {
      clearInterval(timerRef.current!);
    }
  }, []);

  // ── Drive the draft: bot picks + user timer
  useEffect(() => {
    if (phase !== "draft" || isDraftComplete || !teams.length) return;

    if (timerRef.current) clearInterval(timerRef.current);

    const pickNum = picksRef.current.length + 1;
    const pickingTeam = teamsRef.current[snakeTeamIndex(pickNum, teamsRef.current.length)];
    if (!pickingTeam) return;

    if (!pickingTeam.isUser) {
      // Bot picks after a short delay
      const delay = 400 + Math.random() * 900;
      const t = setTimeout(() => {
        const avail = playersRef.current.filter(p => !new Set(picksRef.current.map(r => r.player.id)).has(p.id));
        const chosen = botPickPlayer(pickingTeam, avail);
        if (chosen) makePick(chosen, picksRef.current.length + 1);
      }, delay);
      return () => clearTimeout(t);
    }

    // User turn — count down
    setTimer(PICK_SECONDS);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto-pick: shortlist first, then best available
          const avail = playersRef.current.filter(p => !new Set(picksRef.current.map(r => r.player.id)).has(p.id));
          const starred = shortlistRef.current.map(id => avail.find(p => p.id === id)).filter((p): p is Player => Boolean(p));
          const userTeam = teamsRef.current.find(t => t.isUser);
          const chosen = starred[0] ?? (userTeam ? botPickPlayer(userTeam, avail) : avail[0]);
          if (chosen) makePick(chosen, picksRef.current.length + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [picks.length, phase, isDraftComplete, teams.length, makePick]);

  // Last-pick toast fade
  useEffect(() => {
    if (lastPickTimer <= 0) return;
    const t = setTimeout(() => setLastPickTimer(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [lastPickTimer]);

  // ── Start draft
  function startDraft() {
    const shuffledBots = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    let botIdx = 0;
    const newTeams: Team[] = Array.from({ length: numTeams }, (_, i) => {
      const pos = i + 1;
      if (pos === draftPosition) {
        return { id: `team-${pos}`, name: "You", isUser: true, draftPosition: pos, picks: [] };
      }
      return { id: `team-${pos}`, name: shuffledBots[botIdx++ % shuffledBots.length], isUser: false, draftPosition: pos, picks: [] };
    });
    teamsRef.current = newTeams;
    picksRef.current = [];
    setTeams(newTeams);
    setPicks([]);
    setTimer(PICK_SECONDS);
    setShortlist([]);
    setSearch("");
    setPosFilter("ALL");
    setActiveTab("available");
    setLastPick(null);
    setPhase("draft");
  }

  function resetToSetup() {
    if (timerRef.current) clearInterval(timerRef.current);
    stopAudio();
    setMuted(true);
    setPhase("setup");
  }

  // ── Setup / Complete screens
  if (phase === "setup") return (
    <SetupScreen numTeams={numTeams} setNumTeams={setNumTeams}
      draftPosition={draftPosition} setDraftPosition={setDraftPosition}
      onStart={startDraft} loadingPlayers={loadingPlayers} />
  );

  if (phase === "complete") return (
    <CompleteScreen teams={teams} onReset={resetToSetup} />
  );

  // ── Theme tokens
  const T = lightMode ? {
    bg:              "#FAF7F2",
    text:            "#1C1410",
    textMuted:       "#7A6650",
    textDim:         "#A89880",
    border:          "rgba(0,0,0,0.09)",
    cardBg:          "rgba(0,0,0,0.03)",
    inputBg:         "rgba(0,0,0,0.05)",
    inputBorder:     "rgba(0,0,0,0.13)",
    inputColor:      "#1C1410",
    btnInactiveBg:   "rgba(0,0,0,0.05)",
    playerRowBg:     "rgba(0,0,0,0.02)",
    playerRowActive: "rgba(0,0,0,0.045)",
    listRowBotBg:    "rgba(0,0,0,0.02)",
    boardCellBotBg:  "rgba(0,0,0,0.06)",
    boardCellEmpty:  "rgba(0,0,0,0.025)",
    boardTeamColor:  "#A89880",
    boardRoundColor: "#A89880",
    pickNumColor:    "#A89880",
    surnameUser:     "#C85020",
    surnameBot:      "#A89880",
    teamNameColor:   "#9A8878",
    emptySlotBorder: "rgba(0,0,0,0.09)",
    emptySlotBg:     "rgba(0,0,0,0.015)",
    starUnselected:  "#C9B99A",
    statusBotBg:     "rgba(0,0,0,0.04)",
    toastBg:         "rgba(0,0,0,0.04)",
    toastBorder:     "rgba(0,0,0,0.1)",
    navCtrlColor:    "#7A6650",
    navCtrlBorder:   "rgba(0,0,0,0.15)",
  } : {
    bg:              "#0F0D0B",
    text:            "#F5F0E8",
    textMuted:       "#8B7355",
    textDim:         "#4A3E34",
    border:          "rgba(255,255,255,0.06)",
    cardBg:          "rgba(255,255,255,0.04)",
    inputBg:         "rgba(255,255,255,0.05)",
    inputBorder:     "rgba(255,255,255,0.1)",
    inputColor:      "#F5F0E8",
    btnInactiveBg:   "rgba(255,255,255,0.04)",
    playerRowBg:     "rgba(255,255,255,0.02)",
    playerRowActive: "rgba(255,255,255,0.035)",
    listRowBotBg:    "rgba(255,255,255,0.02)",
    boardCellBotBg:  "rgba(255,255,255,0.05)",
    boardCellEmpty:  "rgba(255,255,255,0.02)",
    boardTeamColor:  "#4A3E34",
    boardRoundColor: "#4A3E34",
    pickNumColor:    "#4A3E34",
    surnameUser:     "#FFAD8A",
    surnameBot:      "#6B5244",
    teamNameColor:   "#6B5244",
    emptySlotBorder: "rgba(255,255,255,0.05)",
    emptySlotBg:     "rgba(255,255,255,0.01)",
    starUnselected:  "#3A2E25",
    statusBotBg:     "rgba(0,0,0,0.2)",
    toastBg:         "rgba(255,255,255,0.04)",
    toastBorder:     "rgba(255,255,255,0.08)",
    navCtrlColor:    "#8B7355",
    navCtrlBorder:   "rgba(255,255,255,0.1)",
  };

  // ── Draft screen
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: T.bg, color: T.text, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", transition: "background 0.25s, color 0.25s" }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: "0 14px", height: 50, display: "flex", alignItems: "center", gap: 10, flexShrink: 0, overflow: "hidden" }}>
        <Link href="/" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 17, color: "#FF5A1F", textDecoration: "none", flexShrink: 0 }}>CURTIS</Link>
        <MockBadge inline />
        <div style={{ flex: 1 }} />

        {/* 🎵 Music toggle */}
        <button
          onClick={() => setMuted(m => !m)}
          title={muted ? "Unmute draft ambience" : "Mute draft ambience"}
          style={{
            background: muted ? T.btnInactiveBg : "rgba(255,90,31,0.12)",
            border: `1px solid ${muted ? T.navCtrlBorder : "rgba(255,90,31,0.35)"}`,
            borderRadius: 6, padding: "4px 9px", cursor: "pointer",
            fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", gap: 5,
            color: muted ? T.navCtrlColor : "#FF5A1F",
            transition: "background 0.2s, border-color 0.2s",
          }}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🎵"}
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 600, letterSpacing: "0.07em" }}>
            {muted ? "MUSIC" : "ON"}
          </span>
        </button>

        {/* ☀/🌙 Theme toggle */}
        <button
          onClick={toggleTheme}
          title={lightMode ? "Switch to dark mode" : "Switch to light mode"}
          style={{
            background: T.btnInactiveBg, border: `1px solid ${T.navCtrlBorder}`,
            borderRadius: 6, padding: "4px 9px", cursor: "pointer",
            fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", gap: 5,
            color: T.navCtrlColor,
          }}
          aria-label={lightMode ? "Dark mode" : "Light mode"}
        >
          {lightMode ? "🌙" : "☀️"}
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 600, letterSpacing: "0.07em" }}>
            {lightMode ? "DARK" : "LIGHT"}
          </span>
        </button>

        <button onClick={resetToSetup} style={{
          fontFamily: "'DM Mono', monospace", fontSize: 9, color: T.navCtrlColor,
          background: "none", border: `1px solid ${T.navCtrlBorder}`, borderRadius: 6,
          padding: "4px 10px", cursor: "pointer", letterSpacing: "0.07em", flexShrink: 0,
        }}>QUIT MOCK</button>
      </nav>

      {/* Status bar */}
      <div style={{
        padding: "8px 14px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
        background: isMyTurn ? "rgba(255,90,31,0.06)" : T.statusBotBg,
        transition: "background 0.4s",
      }}>
        {isMyTurn && <PickTimer seconds={timer} total={PICK_SECONDS} />}

        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, color: T.text }}>
            {isDraftComplete ? "Draft Complete!" :
             isMyTurn ? "⚡ Your pick — choose wisely" :
             `${currentPickingTeam?.name ?? "…"} is picking`}
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: T.textMuted, marginTop: 1 }}>
            Round {currentRound} of {SQUAD_SIZE} · Pick {Math.min(currentPickNum, totalDraftPicks)} of {totalDraftPicks}
          </div>
        </div>

        {/* Last pick toast */}
        {lastPick && lastPickTimer > 0 && (
          <div style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
            background: T.toastBg, border: `1px solid ${T.toastBorder}`,
            borderRadius: 8, padding: "5px 12px",
            opacity: lastPickTimer <= 1 ? 0.4 : 1, transition: "opacity 0.6s",
          }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: T.textDim }}>Last:</span>
            <ClubBadge club={lastPick.player.club} size={18} />
            <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{lastPick.player.name}</span>
            <PosChip pos={lastPick.player.position} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: T.textMuted }}>→ {lastPick.teamName}</span>
          </div>
        )}

        {isDraftComplete && (
          <button onClick={() => setPhase("complete")} style={{
            marginLeft: "auto", padding: "8px 18px", borderRadius: 8, border: "none",
            background: "#FF5A1F", color: "white", fontFamily: "'DM Mono', monospace",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer",
          }}>VIEW RESULTS →</button>
        )}
      </div>

      {/* 3-column layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", paddingBottom: isMobile ? 56 : 0 }}>

        {/* LEFT: Draft board */}
        <div style={{
          width: isMobile ? undefined : 250,
          flex: isMobile ? 1 : undefined,
          borderRight: isMobile ? "none" : `1px solid ${T.border}`,
          display: isMobile && mobileTab !== "board" ? "none" : "flex",
          flexDirection: "column",
          overflow: "hidden",
          flexShrink: 0,
        }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 5, flexShrink: 0 }}>
            {(["board","list"] as const).map(v => (
              <button key={v} onClick={() => setBoardView(v)} style={{
                flex: 1, padding: "5px 0", borderRadius: 6, border: "none", cursor: "pointer",
                background: boardView === v ? "rgba(255,90,31,0.14)" : T.btnInactiveBg,
                color: boardView === v ? "#FF5A1F" : T.textMuted,
                fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em",
              }}>{v === "board" ? "BOARD" : "LIST"}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
            {boardView === "board" ? (
              <div>
                {/* Team header row */}
                <div style={{ display: "grid", gridTemplateColumns: `20px repeat(${numTeams}, 1fr)`, gap: 2, marginBottom: 4 }}>
                  <div />
                  {teams.map(t => (
                    <div key={t.id} style={{
                      textAlign: "center", fontSize: 7, fontFamily: "'DM Mono', monospace",
                      fontWeight: 700, letterSpacing: "0.04em",
                      color: t.isUser ? "#FF5A1F" : T.boardTeamColor,
                      overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                    }}>{t.isUser ? "YOU" : t.name.split(" ")[0].slice(0, 6)}</div>
                  ))}
                </div>
                {/* Round rows */}
                {Array.from({ length: SQUAD_SIZE }, (_, roundIdx) => {
                  const round = roundIdx + 1;
                  return (
                    <div key={round} style={{ display: "grid", gridTemplateColumns: `20px repeat(${numTeams}, 1fr)`, gap: 2, marginBottom: 2 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 7.5, color: T.boardRoundColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        R{round}
                      </div>
                      {teams.map(t => {
                        const pNum = pickNumForCell(round, t.draftPosition, numTeams);
                        const pickRecord = picks.find(p => p.pickNum === pNum);
                        const isCurrent = !isDraftComplete && currentPickNum === pNum;
                        return (
                          <div key={t.id} style={{
                            height: 24, borderRadius: 3, overflow: "hidden",
                            background: pickRecord
                              ? (t.isUser ? "rgba(255,90,31,0.22)" : T.boardCellBotBg)
                              : isCurrent ? "rgba(255,90,31,0.12)" : T.boardCellEmpty,
                            border: `1px solid ${t.isUser ? "rgba(255,90,31,0.22)" : T.border}`,
                            display: "flex", alignItems: "center", padding: "0 3px",
                          }}>
                            {pickRecord ? (
                              <span style={{
                                fontFamily: "'DM Sans', sans-serif", fontSize: 7, lineHeight: 1.1,
                                color: t.isUser ? T.surnameUser : T.surnameBot,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {pickRecord.player.name.split(" ").slice(-1)[0]}
                              </span>
                            ) : isCurrent ? (
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF5A1F", margin: "auto", animation: "pulse 1s ease-in-out infinite" }} />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {picks.map(p => {
                  const t = teams.find(tt => tt.id === p.teamId);
                  return (
                    <div key={p.pickNum} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "5px 7px",
                      background: t?.isUser ? "rgba(255,90,31,0.08)" : T.listRowBotBg,
                      borderRadius: 5,
                    }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8.5, color: T.pickNumColor, minWidth: 18, flexShrink: 0 }}>{p.pickNum}.</span>
                      <ClubBadge club={p.player.club} size={16} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.text }}>{p.player.name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: T.teamNameColor }}>{t?.isUser ? "YOU" : (t?.name.split(" ")[0] ?? "?")}</div>
                      </div>
                      <PosChip pos={p.player.position} />
                    </div>
                  );
                })}
                {!isDraftComplete && (
                  <div style={{ textAlign: "center", padding: 10, fontFamily: "'DM Mono', monospace", fontSize: 9, color: T.textDim }}>
                    Pick {currentPickNum} in progress…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE: Player browser */}
        <div style={{
          flex: 1,
          display: isMobile && mobileTab !== "players" ? "none" : "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Search + pos filters */}
          <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search players or clubs…"
              style={{
                flex: 1, minWidth: 130, padding: "7px 12px",
                background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                borderRadius: 8, color: T.inputColor, fontFamily: "'DM Sans', sans-serif",
                fontSize: 13, outline: "none",
              }}
            />
            {["ALL","GK","DEF","MID","FWD"].map(pos => (
              <button key={pos} onClick={() => setPosFilter(pos)} style={{
                padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: posFilter === pos ? "rgba(255,90,31,0.15)" : T.btnInactiveBg,
                color: posFilter === pos ? "#FF5A1F" : T.textMuted,
                fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
              }}>{pos}</button>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ padding: "5px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 4, flexShrink: 0 }}>
            {(["available","shortlist"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                background: activeTab === tab ? "rgba(255,90,31,0.14)" : "transparent",
                color: activeTab === tab ? "#FF5A1F" : T.textMuted,
                fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.07em",
              }}>
                {tab === "available" ? `AVAILABLE (${available.length})` : `★ SHORTLIST (${shortlistedAvailable.length})`}
              </button>
            ))}
            {shortlist.length > 0 && activeTab === "available" && (
              <div style={{ marginLeft: "auto", fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#8B5E3C", display: "flex", alignItems: "center" }}>
                ★ {shortlist.filter(id => !pickedIds.has(id)).length} queued for auto-pick
              </div>
            )}
          </div>

          {/* Player rows */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px" }}>
            {displayPlayers.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.textDim }}>
                {activeTab === "shortlist" ? "No players in shortlist" : "No players match"}
              </div>
            )}
            {displayPlayers.map(p => {
              const isStarred = shortlist.includes(p.id);
              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  borderRadius: 8, marginBottom: 3,
                  background: isMyTurn ? T.playerRowActive : T.playerRowBg,
                  border: `1px solid ${isStarred ? "rgba(255,215,0,0.25)" : T.border}`,
                }}>
                  <ClubBadge club={p.club} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.text }}>{p.name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: T.textMuted }}>
                      {p.club} · {p.season_points.toFixed(0)} pts last season{p.api_rank ? ` · Rank #${p.api_rank}` : ""}
                    </div>
                  </div>
                  <PosChip pos={p.position} />
                  <button
                    onClick={() => setShortlist(prev => isStarred ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                    title={isStarred ? "Remove from shortlist" : "Add to shortlist (auto-picks if timer expires)"}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 15, color: isStarred ? "#FFD700" : T.starUnselected,
                      padding: "2px 4px", lineHeight: 1, flexShrink: 0,
                    }}
                  >★</button>
                  {isMyTurn && (
                    <button onClick={() => makePick(p, currentPickNum)} style={{
                      padding: "6px 14px", borderRadius: 7, border: "none",
                      background: "#FF5A1F", color: "white",
                      fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.06em", cursor: "pointer", flexShrink: 0,
                    }}>PICK</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: My Squad */}
        <div style={{
          width: isMobile ? undefined : 220,
          flex: isMobile ? 1 : undefined,
          borderLeft: isMobile ? "none" : `1px solid ${T.border}`,
          display: isMobile && mobileTab !== "squad" ? "none" : "flex",
          flexDirection: "column",
          overflow: "hidden",
          flexShrink: isMobile ? undefined : 0,
        }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: T.textMuted }}>YOUR SQUAD</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: T.textDim, marginTop: 2 }}>
              {myTeam?.picks.length ?? 0}/{SQUAD_SIZE} picked
              {myTeam && myTeam.picks.length > 0 && (
                <span style={{ color: T.textMuted }}> · {myTeam.picks.reduce((s, p) => s + p.season_points, 0).toFixed(0)} proj pts</span>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
            {(["GK","DEF","MID","FWD"] as const).map(pos => {
              const posPicks = (myTeam?.picks ?? []).filter(p => p.position === pos);
              const target = POSITION_TARGETS[pos];
              return (
                <div key={pos} style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.07em", color: T.textMuted, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                    <span>{pos}</span>
                    <span style={{ color: posPicks.length >= target ? "#22C55E" : T.textDim }}>{posPicks.length}/{target}</span>
                  </div>
                  {posPicks.map(p => (
                    <div key={p.id} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "5px 6px",
                      background: "rgba(255,90,31,0.08)", border: "1px solid rgba(255,90,31,0.18)",
                      borderRadius: 6, marginBottom: 3,
                    }}>
                      <ClubBadge club={p.club} size={18} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.text }}>{p.name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: T.textMuted }}>{p.season_points.toFixed(0)} pts</div>
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: target - posPicks.length }, (_, i) => (
                    <div key={i} style={{ height: 28, borderRadius: 5, marginBottom: 3, border: `1px dashed ${T.emptySlotBorder}`, background: T.emptySlotBg }} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="mobile-tab-bar" style={{ background: T.bg, borderTop: `1px solid ${T.border}` }}>
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
                color: isActive ? "#FF5A1F" : T.navCtrlColor,
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

      <style>{`@keyframes pulse { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.5; transform:scale(0.75) } }`}</style>
    </div>
  );
}

// ─── FALLBACK PLAYER POOL ─────────────────────────────────────────────────────
// Used when Supabase returns fewer than 80 players

const FALLBACK_PLAYERS: Player[] = [
  // GKs (20)
  { id:"fb-gk1",  name:"Alisson",       club:"LIV", position:"GK",  api_rank:1,  season_points:168 },
  { id:"fb-gk2",  name:"Ederson",       club:"MCI", position:"GK",  api_rank:2,  season_points:155 },
  { id:"fb-gk3",  name:"Raya",          club:"ARS", position:"GK",  api_rank:3,  season_points:142 },
  { id:"fb-gk4",  name:"Flekken",       club:"BRE", position:"GK",  api_rank:4,  season_points:124 },
  { id:"fb-gk5",  name:"Fabianski",     club:"WHU", position:"GK",  api_rank:5,  season_points:112 },
  { id:"fb-gk6",  name:"Pope",          club:"NEW", position:"GK",  api_rank:6,  season_points:108 },
  { id:"fb-gk7",  name:"Flekken",       club:"BRE", position:"GK",  api_rank:7,  season_points:105 },
  { id:"fb-gk8",  name:"Neto",          club:"BOU", position:"GK",  api_rank:8,  season_points:98  },
  { id:"fb-gk9",  name:"Flaherty",      club:"NFO", position:"GK",  api_rank:9,  season_points:92  },
  { id:"fb-gk10", name:"Foster",        club:"EVE", position:"GK",  api_rank:10, season_points:88  },
  { id:"fb-gk11", name:"Henderson",     club:"FUL", position:"GK",  api_rank:11, season_points:85  },
  { id:"fb-gk12", name:"Pickford",      club:"EVE", position:"GK",  api_rank:12, season_points:83  },
  { id:"fb-gk13", name:"Verbruggen",    club:"BHA", position:"GK",  api_rank:13, season_points:80  },
  { id:"fb-gk14", name:"Areola",        club:"WHU", position:"GK",  api_rank:14, season_points:76  },
  { id:"fb-gk15", name:"Johnstone",     club:"CRY", position:"GK",  api_rank:15, season_points:72  },
  { id:"fb-gk16", name:"Forster",       club:"TOT", position:"GK",  api_rank:16, season_points:68  },
  { id:"fb-gk17", name:"Turner",        club:"ARS", position:"GK",  api_rank:17, season_points:64  },
  { id:"fb-gk18", name:"Trafford",      club:"BUR", position:"GK",  api_rank:18, season_points:60  },
  { id:"fb-gk19", name:"Flaherty",      club:"NFO", position:"GK",  api_rank:19, season_points:56  },
  { id:"fb-gk20", name:"Meslier",       club:"LEE", position:"GK",  api_rank:20, season_points:52  },
  // DEFs (40)
  { id:"fb-d1",  name:"Alexander-Arnold", club:"LIV", position:"DEF", api_rank:1,  season_points:218 },
  { id:"fb-d2",  name:"Trippier",          club:"NEW", position:"DEF", api_rank:2,  season_points:196 },
  { id:"fb-d3",  name:"Pedro Porro",       club:"TOT", position:"DEF", api_rank:3,  season_points:172 },
  { id:"fb-d4",  name:"Gabriel",           club:"ARS", position:"DEF", api_rank:4,  season_points:162 },
  { id:"fb-d5",  name:"White",             club:"ARS", position:"DEF", api_rank:5,  season_points:154 },
  { id:"fb-d6",  name:"Robertson",         club:"LIV", position:"DEF", api_rank:6,  season_points:148 },
  { id:"fb-d7",  name:"Mykolenko",         club:"EVE", position:"DEF", api_rank:7,  season_points:138 },
  { id:"fb-d8",  name:"Cash",              club:"AVL", position:"DEF", api_rank:8,  season_points:132 },
  { id:"fb-d9",  name:"Saliba",            club:"ARS", position:"DEF", api_rank:9,  season_points:128 },
  { id:"fb-d10", name:"Timber",            club:"ARS", position:"DEF", api_rank:10, season_points:122 },
  { id:"fb-d11", name:"Konsa",             club:"AVL", position:"DEF", api_rank:11, season_points:118 },
  { id:"fb-d12", name:"Dunk",              club:"BHA", position:"DEF", api_rank:12, season_points:112 },
  { id:"fb-d13", name:"Van Dijk",          club:"LIV", position:"DEF", api_rank:13, season_points:108 },
  { id:"fb-d14", name:"Mykolenko",         club:"EVE", position:"DEF", api_rank:14, season_points:104 },
  { id:"fb-d15", name:"Targett",           club:"NFO", position:"DEF", api_rank:15, season_points:100 },
  { id:"fb-d16", name:"Castagne",          club:"FUL", position:"DEF", api_rank:16, season_points:96  },
  { id:"fb-d17", name:"Estupinan",         club:"BHA", position:"DEF", api_rank:17, season_points:93  },
  { id:"fb-d18", name:"Wan-Bissaka",       club:"WHU", position:"DEF", api_rank:18, season_points:90  },
  { id:"fb-d19", name:"Dalot",             club:"MUN", position:"DEF", api_rank:19, season_points:87  },
  { id:"fb-d20", name:"James",             club:"CHE", position:"DEF", api_rank:20, season_points:84  },
  { id:"fb-d21", name:"Guehi",             club:"CRY", position:"DEF", api_rank:21, season_points:81  },
  { id:"fb-d22", name:"Botman",            club:"NEW", position:"DEF", api_rank:22, season_points:78  },
  { id:"fb-d23", name:"Cuenca",            club:"MCI", position:"DEF", api_rank:23, season_points:75  },
  { id:"fb-d24", name:"Dier",              club:"MCI", position:"DEF", api_rank:24, season_points:72  },
  { id:"fb-d25", name:"Akanji",            club:"MCI", position:"DEF", api_rank:25, season_points:70  },
  { id:"fb-d26", name:"O'Brien",           club:"NEW", position:"DEF", api_rank:26, season_points:68  },
  { id:"fb-d27", name:"Mings",             club:"AVL", position:"DEF", api_rank:27, season_points:65  },
  { id:"fb-d28", name:"Collins",           club:"BUR", position:"DEF", api_rank:28, season_points:62  },
  { id:"fb-d29", name:"Thomas",            club:"ARS", position:"DEF", api_rank:29, season_points:60  },
  { id:"fb-d30", name:"Quansah",           club:"LIV", position:"DEF", api_rank:30, season_points:57  },
  { id:"fb-d31", name:"Ayling",            club:"LEE", position:"DEF", api_rank:31, season_points:54  },
  { id:"fb-d32", name:"Lowe",              club:"BHA", position:"DEF", api_rank:32, season_points:52  },
  { id:"fb-d33", name:"Godfrey",           club:"EVE", position:"DEF", api_rank:33, season_points:50  },
  { id:"fb-d34", name:"Mepham",            club:"BOU", position:"DEF", api_rank:34, season_points:48  },
  { id:"fb-d35", name:"Coburn",            club:"BRE", position:"DEF", api_rank:35, season_points:46  },
  { id:"fb-d36", name:"Ward",              club:"CRY", position:"DEF", api_rank:36, season_points:44  },
  { id:"fb-d37", name:"Reguilon",          club:"BRE", position:"DEF", api_rank:37, season_points:42  },
  { id:"fb-d38", name:"Hall",              club:"LIV", position:"DEF", api_rank:38, season_points:40  },
  { id:"fb-d39", name:"Bednarek",          club:"SUN", position:"DEF", api_rank:39, season_points:38  },
  { id:"fb-d40", name:"Kristensen",        club:"SUN", position:"DEF", api_rank:40, season_points:36  },
  // MIDs (45)
  { id:"fb-m1",  name:"Salah",          club:"LIV", position:"MID", api_rank:1,  season_points:316 },
  { id:"fb-m2",  name:"Saka",           club:"ARS", position:"MID", api_rank:2,  season_points:258 },
  { id:"fb-m3",  name:"Palmer",         club:"CHE", position:"MID", api_rank:3,  season_points:244 },
  { id:"fb-m4",  name:"Maddison",       club:"TOT", position:"MID", api_rank:4,  season_points:192 },
  { id:"fb-m5",  name:"De Bruyne",      club:"MCI", position:"MID", api_rank:5,  season_points:184 },
  { id:"fb-m6",  name:"Diaz",           club:"LIV", position:"MID", api_rank:6,  season_points:178 },
  { id:"fb-m7",  name:"Son",            club:"TOT", position:"MID", api_rank:7,  season_points:172 },
  { id:"fb-m8",  name:"Fernandes",      club:"MUN", position:"MID", api_rank:8,  season_points:166 },
  { id:"fb-m9",  name:"Mbeumo",         club:"BRE", position:"MID", api_rank:9,  season_points:158 },
  { id:"fb-m10", name:"Havertz",        club:"ARS", position:"MID", api_rank:10, season_points:150 },
  { id:"fb-m11", name:"Gordon",         club:"NEW", position:"MID", api_rank:11, season_points:144 },
  { id:"fb-m12", name:"Luiz",           club:"NFO", position:"MID", api_rank:12, season_points:138 },
  { id:"fb-m13", name:"Mitoma",         club:"BHA", position:"MID", api_rank:13, season_points:132 },
  { id:"fb-m14", name:"Neto",           club:"BOU", position:"MID", api_rank:14, season_points:128 },
  { id:"fb-m15", name:"Gallagher",      club:"AVL", position:"MID", api_rank:15, season_points:122 },
  { id:"fb-m16", name:"Savinho",        club:"MCI", position:"MID", api_rank:16, season_points:118 },
  { id:"fb-m17", name:"Semenyo",        club:"BOU", position:"MID", api_rank:17, season_points:114 },
  { id:"fb-m18", name:"Rashford",       club:"MUN", position:"MID", api_rank:18, season_points:110 },
  { id:"fb-m19", name:"Sterling",       club:"CHE", position:"MID", api_rank:19, season_points:106 },
  { id:"fb-m20", name:"Trossard",       club:"ARS", position:"MID", api_rank:20, season_points:102 },
  { id:"fb-m21", name:"McNeil",         club:"EVE", position:"MID", api_rank:21, season_points:98  },
  { id:"fb-m22", name:"Gross",          club:"BHA", position:"MID", api_rank:22, season_points:95  },
  { id:"fb-m23", name:"Andreas",        club:"FUL", position:"MID", api_rank:23, season_points:91  },
  { id:"fb-m24", name:"Perisic",        club:"TOT", position:"MID", api_rank:24, season_points:88  },
  { id:"fb-m25", name:"Wood",           club:"NFO", position:"MID", api_rank:25, season_points:85  },
  { id:"fb-m26", name:"Lookman",        club:"AVL", position:"MID", api_rank:26, season_points:82  },
  { id:"fb-m27", name:"Eze",            club:"CRY", position:"MID", api_rank:27, season_points:79  },
  { id:"fb-m28", name:"Mbuemo",         club:"BRE", position:"MID", api_rank:28, season_points:76  },
  { id:"fb-m29", name:"Dango",          club:"BOU", position:"MID", api_rank:29, season_points:73  },
  { id:"fb-m30", name:"Adama",          club:"FUL", position:"MID", api_rank:30, season_points:70  },
  { id:"fb-m31", name:"Doucoure",       club:"EVE", position:"MID", api_rank:31, season_points:67  },
  { id:"fb-m32", name:"Winks",          club:"FUL", position:"MID", api_rank:32, season_points:64  },
  { id:"fb-m33", name:"Fornals",        club:"WHU", position:"MID", api_rank:33, season_points:61  },
  { id:"fb-m34", name:"Bowen",          club:"WHU", position:"MID", api_rank:34, season_points:58  },
  { id:"fb-m35", name:"Kudus",          club:"WHU", position:"MID", api_rank:35, season_points:55  },
  { id:"fb-m36", name:"Muniz",          club:"FUL", position:"MID", api_rank:36, season_points:53  },
  { id:"fb-m37", name:"Nkunku",         club:"CHE", position:"MID", api_rank:37, season_points:51  },
  { id:"fb-m38", name:"Shelvey",        club:"NFO", position:"MID", api_rank:38, season_points:49  },
  { id:"fb-m39", name:"Philogene",      club:"AVL", position:"MID", api_rank:39, season_points:47  },
  { id:"fb-m40", name:"Tete",           club:"LEE", position:"MID", api_rank:40, season_points:45  },
  { id:"fb-m41", name:"Gruev",          club:"LEE", position:"MID", api_rank:41, season_points:43  },
  { id:"fb-m42", name:"Ba",             club:"BUR", position:"MID", api_rank:42, season_points:41  },
  { id:"fb-m43", name:"Cullen",         club:"BUR", position:"MID", api_rank:43, season_points:39  },
  { id:"fb-m44", name:"O'Nien",         club:"SUN", position:"MID", api_rank:44, season_points:37  },
  { id:"fb-m45", name:"Cirkin",         club:"SUN", position:"MID", api_rank:45, season_points:35  },
  // FWDs (35)
  { id:"fb-f1",  name:"Haaland",        club:"MCI", position:"FWD", api_rank:1,  season_points:292 },
  { id:"fb-f2",  name:"Watkins",        club:"AVL", position:"FWD", api_rank:2,  season_points:248 },
  { id:"fb-f3",  name:"Isak",           club:"NEW", position:"FWD", api_rank:3,  season_points:225 },
  { id:"fb-f4",  name:"Diogo Jota",     club:"LIV", position:"FWD", api_rank:4,  season_points:198 },
  { id:"fb-f5",  name:"Firmino",        club:"ARS", position:"FWD", api_rank:5,  season_points:188 },
  { id:"fb-f6",  name:"Toney",          club:"BRE", position:"FWD", api_rank:6,  season_points:178 },
  { id:"fb-f7",  name:"Darwin Nunez",   club:"LIV", position:"FWD", api_rank:7,  season_points:168 },
  { id:"fb-f8",  name:"Rashford",       club:"MUN", position:"FWD", api_rank:8,  season_points:158 },
  { id:"fb-f9",  name:"Solanke",        club:"TOT", position:"FWD", api_rank:9,  season_points:150 },
  { id:"fb-f10", name:"Antonio",        club:"WHU", position:"FWD", api_rank:10, season_points:142 },
  { id:"fb-f11", name:"Richarlison",    club:"TOT", position:"FWD", api_rank:11, season_points:135 },
  { id:"fb-f12", name:"Calvert-Lewin",  club:"EVE", position:"FWD", api_rank:12, season_points:128 },
  { id:"fb-f13", name:"Lautaro",        club:"MCI", position:"FWD", api_rank:13, season_points:122 },
  { id:"fb-f14", name:"Sargent",        club:"NFO", position:"FWD", api_rank:14, season_points:116 },
  { id:"fb-f15", name:"Welbeck",        club:"BHA", position:"FWD", api_rank:15, season_points:110 },
  { id:"fb-f16", name:"Jackson",        club:"CHE", position:"FWD", api_rank:16, season_points:104 },
  { id:"fb-f17", name:"Archer",         club:"AVL", position:"FWD", api_rank:17, season_points:98  },
  { id:"fb-f18", name:"Muniz",          club:"BRE", position:"FWD", api_rank:18, season_points:93  },
  { id:"fb-f19", name:"Wilson",         club:"NEW", position:"FWD", api_rank:19, season_points:88  },
  { id:"fb-f20", name:"Deeney",         club:"FUL", position:"FWD", api_rank:20, season_points:84  },
  { id:"fb-f21", name:"Zaha",           club:"CRY", position:"FWD", api_rank:21, season_points:80  },
  { id:"fb-f22", name:"Ings",           club:"WHU", position:"FWD", api_rank:22, season_points:76  },
  { id:"fb-f23", name:"Oduya",          club:"BHA", position:"FWD", api_rank:23, season_points:72  },
  { id:"fb-f24", name:"Balogun",        club:"FUL", position:"FWD", api_rank:24, season_points:68  },
  { id:"fb-f25", name:"Summerville",    club:"LEE", position:"FWD", api_rank:25, season_points:65  },
  { id:"fb-f26", name:"Gnonto",         club:"LEE", position:"FWD", api_rank:26, season_points:62  },
  { id:"fb-f27", name:"Ekwah",          club:"SUN", position:"FWD", api_rank:27, season_points:59  },
  { id:"fb-f28", name:"Mayulu",         club:"MUN", position:"FWD", api_rank:28, season_points:56  },
  { id:"fb-f29", name:"Zirkzee",        club:"MUN", position:"FWD", api_rank:29, season_points:53  },
  { id:"fb-f30", name:"Delap",          club:"MCI", position:"FWD", api_rank:30, season_points:50  },
  { id:"fb-f31", name:"Maupay",         club:"BOU", position:"FWD", api_rank:31, season_points:47  },
  { id:"fb-f32", name:"Liel Abada",     club:"BHA", position:"FWD", api_rank:32, season_points:44  },
  { id:"fb-f33", name:"Piroe",          club:"NFO", position:"FWD", api_rank:33, season_points:41  },
  { id:"fb-f34", name:"Larkem",         club:"BUR", position:"FWD", api_rank:34, season_points:38  },
  { id:"fb-f35", name:"Roberts",        club:"SUN", position:"FWD", api_rank:35, season_points:35  },
];
