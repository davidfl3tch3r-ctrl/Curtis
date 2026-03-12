"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";

type SyncResult = { synced?: number; ok?: boolean; round?: number; fixtures?: number; scored?: number; statsProcessed?: number; teamsUpdated?: number; error?: string };

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "var(--c-text)" }}>{value}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function AdminSyncPage() {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [syncingPlayers, setSyncingPlayers] = useState(false);
  const [playerResult, setPlayerResult] = useState<SyncResult | null>(null);

  const [round, setRound] = useState("");
  const [syncingScores, setSyncingScores] = useState(false);
  const [scoreResult, setScoreResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    async function loadCount() {
      const supabase = createClient();
      const { count } = await supabase.from("players").select("*", { count: "exact", head: true });
      setPlayerCount(count ?? 0);
    }
    loadCount();
  }, [playerResult]);

  async function handleSyncPlayers() {
    setSyncingPlayers(true);
    setPlayerResult(null);
    try {
      const res = await fetch("/api/sync/players", { method: "POST" });
      setPlayerResult(await res.json());
    } catch {
      setPlayerResult({ error: "Network error" });
    } finally {
      setSyncingPlayers(false);
    }
  }

  async function handleSyncScores() {
    setSyncingScores(true);
    setScoreResult(null);
    try {
      const body = round.trim() ? { round: parseInt(round, 10) } : {};
      const res = await fetch("/api/score/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setScoreResult(await res.json());
    } catch {
      setScoreResult({ error: "Network error" });
    } finally {
      setSyncingScores(false);
    }
  }

  const card: React.CSSProperties = {
    background: "var(--c-card)", borderRadius: 16, padding: "28px 32px",
    border: "1.5px solid var(--c-card-border)", marginBottom: 20,
  };
  const label: React.CSSProperties = {
    fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em",
    textTransform: "uppercase", color: "var(--c-text-muted)", marginBottom: 8, display: "block",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", padding: "40px 24px" }}>
      <div style={{ position: "fixed", top: 16, right: 16 }}><ThemeToggle /></div>
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 900, letterSpacing: "0.08em", color: "var(--c-text)" }}>CURTIS</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-muted)", marginTop: 6 }}>Admin · Data Sync</div>
        </div>

        {/* ── Player Sync ── */}
        <div style={card}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "var(--c-text)", margin: "0 0 4px 0" }}>Player Roster</h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", margin: "0 0 20px 0", lineHeight: 1.5 }}>
            Pull all PL squad players from API-Football. Uses ~25 API calls.
          </p>

          <div style={{ background: "var(--c-bg)", borderRadius: 10, padding: "12px 18px", border: "1px solid var(--c-border)", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={label as React.CSSProperties}>Players in DB</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "var(--c-text)" }}>
              {playerCount === null ? "—" : playerCount.toLocaleString()}
            </span>
          </div>

          {playerResult && (
            <div style={{ borderRadius: 8, padding: "10px 14px", marginBottom: 16, background: playerResult.error ? "#FDF2F2" : "#F0FDF4", border: `1px solid ${playerResult.error ? "#F5C6C6" : "#BBF7D0"}`, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: playerResult.error ? "#C0392B" : "#166534" }}>
              {playerResult.error ? `Error: ${playerResult.error}` : `Synced ${playerResult.synced?.toLocaleString()} players.`}
            </div>
          )}

          <button onClick={handleSyncPlayers} disabled={syncingPlayers} style={{ width: "100%", padding: "12px", background: syncingPlayers ? "#E8A88A" : "#FF5A1F", color: "white", border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: syncingPlayers ? "not-allowed" : "pointer" }}>
            {syncingPlayers ? "Syncing players…" : "Sync Players from API-Football"}
          </button>
        </div>

        {/* ── Score Sync ── */}
        <div style={card}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "var(--c-text)", margin: "0 0 4px 0" }}>Gameweek Scores</h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", margin: "0 0 20px 0", lineHeight: 1.5 }}>
            Fetch fixture results + player stats, calculate fantasy points, update all team scores. Leave round blank to use current round.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Round number (optional)</label>
            <input
              type="number"
              value={round}
              onChange={e => setRound(e.target.value)}
              placeholder="e.g. 32 — leave blank for current"
              style={{ width: "100%", padding: "10px 12px", fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--c-text)", background: "var(--c-input)", border: "1.5px solid var(--c-input-border)", borderRadius: 8, outline: "none", boxSizing: "border-box" }}
              onFocus={e => (e.target.style.borderColor = "#FF5A1F")}
              onBlur={e => (e.target.style.borderColor = "var(--c-input-border)")}
            />
          </div>

          {scoreResult && (
            <div style={{ borderRadius: 8, padding: "12px 16px", marginBottom: 16, background: scoreResult.error ? "#FDF2F2" : "#F0FDF4", border: `1px solid ${scoreResult.error ? "#F5C6C6" : "#BBF7D0"}` }}>
              {scoreResult.error ? (
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#C0392B" }}>Error: {scoreResult.error}</span>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                  <StatPill label="Round" value={scoreResult.round ?? "—"} />
                  <StatPill label="Fixtures" value={scoreResult.fixtures ?? 0} />
                  <StatPill label="Scored" value={scoreResult.scored ?? 0} />
                  <StatPill label="Stats" value={scoreResult.statsProcessed ?? 0} />
                  <StatPill label="Teams" value={scoreResult.teamsUpdated ?? 0} />
                </div>
              )}
            </div>
          )}

          <button onClick={handleSyncScores} disabled={syncingScores} style={{ width: "100%", padding: "12px", background: syncingScores ? "#E8A88A" : "#FF5A1F", color: "white", border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: syncingScores ? "not-allowed" : "pointer" }}>
            {syncingScores ? "Syncing scores… this may take a minute" : "Sync Scores from API-Football"}
          </button>

          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)", letterSpacing: "0.05em", textAlign: "center", marginTop: 14, marginBottom: 0 }}>
            Season 2025 · League ID 39 · Free tier: 100 req/day
          </p>
        </div>
      </div>
    </div>
  );
}
