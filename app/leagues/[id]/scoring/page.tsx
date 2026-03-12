"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavBar } from "@/components/NavBar";
import { useIsMobile } from "@/lib/use-is-mobile";

const SCORING_CATEGORIES = [
  { label: "Goal", group: "Attacking" },
  { label: "Assist", group: "Attacking" },
  { label: "Key Pass", group: "Attacking" },
  { label: "Shot on Target", group: "Attacking" },
  { label: "Big Chance Created", group: "Attacking" },
  { label: "40+ Passes @ 80%", group: "Passing" },
  { label: "50+ Passes @ 80%", group: "Passing" },
  { label: "60+ Passes @ 80%", group: "Passing" },
  { label: "1–60 Min Played", group: "Appearance" },
  { label: "61–89 Min Played", group: "Appearance" },
  { label: "90+ Min Played", group: "Appearance" },
  { label: "Tackle Won", group: "Defensive" },
  { label: "Interception", group: "Defensive" },
  { label: "Clean Sheet", group: "Defensive" },
  { label: "Goal Conceded", group: "Defensive" },
  { label: "Save", group: "Defensive" },
  { label: "Penalty Save", group: "Defensive" },
  { label: "Yellow Card", group: "Discipline" },
  { label: "Red Card", group: "Discipline" },
  { label: "Own Goal", group: "Discipline" },
  { label: "Penalty Missed", group: "Discipline" },
  { label: "Defensive Error", group: "Discipline" },
];

type ScoreValues = Record<string, Record<string, number | string>>;

const DEFAULT_VALUES: ScoreValues = {
  "Goal":               { FWD: 5,    MID: 6,    DEF: 7,    GK: 8    },
  "Assist":             { FWD: 2.5,  MID: 3,    DEF: 3.5,  GK: 4    },
  "Key Pass":           { FWD: 1,    MID: 1,    DEF: 1,    GK: 1    },
  "Shot on Target":     { FWD: 0.5,  MID: 0.5,  DEF: 0.5,  GK: 0.5  },
  "Big Chance Created": { FWD: 1,    MID: 1,    DEF: 1,    GK: 1    },
  "40+ Passes @ 80%":   { FWD: 4,    MID: 4,    DEF: 4,    GK: 4    },
  "50+ Passes @ 80%":   { FWD: 4.5,  MID: 4.5,  DEF: 4.5,  GK: 4.5  },
  "60+ Passes @ 80%":   { FWD: 5,    MID: 5,    DEF: 5,    GK: 5    },
  "1–60 Min Played":    { FWD: 1,    MID: 1,    DEF: 1,    GK: 1    },
  "61–89 Min Played":   { FWD: 2,    MID: 2,    DEF: 2,    GK: 2    },
  "90+ Min Played":     { FWD: 3,    MID: 3,    DEF: 3,    GK: 3    },
  "Tackle Won":         { FWD: 0.5,  MID: 0.5,  DEF: 0.5,  GK: 0.5  },
  "Interception":       { FWD: 0.5,  MID: 0.5,  DEF: 0.5,  GK: 0.5  },
  "Clean Sheet":        { FWD: 0,    MID: 2,    DEF: 5,    GK: 5    },
  "Goal Conceded":      { FWD: 0,    MID: -0.5, DEF: -1,   GK: -1   },
  "Save":               { FWD: 0,    MID: 0,    DEF: 0,    GK: 0.5  },
  "Penalty Save":       { FWD: 0,    MID: 0,    DEF: 0,    GK: 2    },
  "Yellow Card":        { FWD: -2,   MID: -2,   DEF: -2,   GK: -2   },
  "Red Card":           { FWD: -4,   MID: -4,   DEF: -4,   GK: -4   },
  "Own Goal":           { FWD: -2,   MID: -2,   DEF: -2,   GK: -2   },
  "Penalty Missed":     { FWD: -2,   MID: -2,   DEF: -2,   GK: -2   },
  "Defensive Error":    { FWD: -0.5, MID: -0.5, DEF: -0.5, GK: -0.5 },
};

const GROUPS = ["Attacking", "Passing", "Appearance", "Defensive", "Discipline"];
const POSITIONS = ["FWD", "MID", "DEF", "GK"];

const GROUP_META: Record<string, { color: string; bg: string; icon: string }> = {
  Attacking:  { color: "#FF5A1F", bg: "#FFF1EC", icon: "⚡" },
  Passing:    { color: "#D97706", bg: "#FFFBEB", icon: "◎" },
  Appearance: { color: "#7C6F5B", bg: "#F7F4EF", icon: "◷" },
  Defensive:  { color: "#2D6A4F", bg: "#EDFAF3", icon: "⬡" },
  Discipline: { color: "#991B1B", bg: "#FEF2F2", icon: "▲" },
};

export default function ScoringMatrixPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const isMobile = useIsMobile();
  const [scores, setScores] = useState<ScoreValues>(DEFAULT_VALUES);
  const [activeGroup, setActiveGroup] = useState("Attacking");
  const [saved, setSaved] = useState(false);

  const navLinks = [
    { label: "Home",     href: "/" },
    { label: "Draft",    href: `/leagues/${leagueId}/draft` },
    { label: "Scoring",  href: `/leagues/${leagueId}/scoring` },
    { label: "Live",     href: `/leagues/${leagueId}/live` },
    { label: "Stats",    href: `/leagues/${leagueId}/table` },
    { label: "Waivers",  href: `/leagues/${leagueId}/waivers` },
    { label: "Trades",   href: `/leagues/${leagueId}/trades` },
    { label: "Chat",     href: `/leagues/${leagueId}/chat` },
    { label: "Messages", href: `/leagues/${leagueId}/messages` },
  ];

  const updateScore = (label: string, pos: string, val: string) => {
    setScores(s => ({ ...s, [label]: { ...s[label], [pos]: val } }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => setScores(DEFAULT_VALUES);

  const filteredCategories = SCORING_CATEGORIES.filter(c => c.group === activeGroup);
  const meta = GROUP_META[activeGroup];

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--c-bg)",
      fontFamily: "Georgia, serif",
      color: "var(--c-text)",
      overflowX: "hidden",
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .score-input {
          width: 60px;
          background: var(--c-input);
          border: 1.5px solid var(--c-input-border);
          border-radius: 8px;
          padding: 9px 4px;
          text-align: center;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          color: var(--c-text);
          outline: none;
          transition: all 0.18s;
        }
        .score-input:focus {
          border-color: #FF5A1F;
          box-shadow: 0 0 0 3px rgba(255,90,31,0.14);
          transform: scale(1.04);
        }
        .score-input.neg { color: #B91C1C; background: #FFF5F5; }
        .score-input.pos { color: #166534; }
        .score-input.zero { color: var(--c-text-muted); }

        .group-tab {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 18px;
          border-radius: 10px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          cursor: pointer;
          border: 1.5px solid transparent;
          transition: all 0.18s;
          background: transparent;
          color: var(--c-text-muted);
        }
        .group-tab:hover { background: var(--c-skeleton); color: var(--c-text); }
        .group-tab.active {
          border-color: transparent;
          color: white;
        }

        .save-btn {
          background: linear-gradient(135deg, #FF5A1F 0%, #E8400A 100%);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 13px 32px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(255,90,31,0.35);
        }
        .save-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255,90,31,0.45); }
        .save-btn.saved { background: linear-gradient(135deg, #16A34A 0%, #15803D 100%); box-shadow: 0 4px 14px rgba(22,163,74,0.3); }

        .reset-btn {
          background: transparent;
          border: 1.5px solid var(--c-border-strong);
          border-radius: 10px;
          padding: 13px 22px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--c-text-muted);
          cursor: pointer;
          transition: all 0.18s;
        }
        .reset-btn:hover { border-color: #FF5A1F; color: #FF5A1F; }

        .stat-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #FFF1EC;
          border: 1px solid #FDDCCC;
          border-radius: 6px;
          padding: 4px 10px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: #FF5A1F;
          letter-spacing: 0.06em;
        }

        .row-wrap:hover { background: rgba(255,90,31,0.03); border-radius: 8px; }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: var(--c-border-strong); border-radius: 2px; }
      `}</style>

      <NavBar links={navLinks} activeLabel="Scoring" right={<ThemeToggle size="sm" />} />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "20px 16px" : "48px 40px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 36, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#FF5A1F",
              }}>League Settings → </span>
              <span style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--c-text-muted)",
              }}>Scoring Matrix</span>
            </div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: isMobile ? 26 : 38,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: "var(--c-text)",
            }}>
              Scoring<br />
              <span style={{ color: "#FF5A1F", fontStyle: "italic" }}>Matrix</span>
            </h1>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 320 }}>
            <div className="stat-pill">◆ 22 Stats Tracked</div>
            <div className="stat-pill">⚡ Opta Live Feed</div>
            <div className="stat-pill">◎ Per-Position Scoring</div>
            <div className="stat-pill">◷ Real-time Updates</div>
          </div>
        </div>

        {/* Curtis callout */}
        <div style={{
          background: "linear-gradient(135deg, #FF5A1F 0%, #E8400A 60%, #C43000 100%)",
          borderRadius: 16,
          padding: "22px 32px",
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 8px 32px rgba(255,90,31,0.3)",
        }}>
          <div>
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.65)",
              marginBottom: 5,
            }}>The Curtis Philosophy</p>
            <p style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18,
              fontWeight: 700,
              color: "white",
              fontStyle: "italic",
            }}>
              "Your CB's 8 interceptions just beat their Salah."
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "0.06em",
            }}>Every stat. Every player.<br />Every position rewarded.</div>
          </div>
        </div>

        {/* Main card */}
        <div className="table-scroll" style={{
          background: "var(--c-bg-elevated)",
          borderRadius: 20,
          border: "1px solid var(--c-border-strong)",
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(28,20,16,0.06)",
        }}>
          {/* Group tabs */}
          <div style={{
            padding: "20px 32px",
            borderBottom: "1px solid var(--c-border-strong)",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            background: "var(--c-bg)",
          }}>
            {GROUPS.map(g => {
              const m = GROUP_META[g];
              const isActive = activeGroup === g;
              return (
                <button
                  key={g}
                  className={`group-tab${isActive ? " active" : ""}`}
                  style={isActive ? { background: m.color } : {}}
                  onClick={() => setActiveGroup(g)}
                >
                  <span style={{ fontSize: 13 }}>{m.icon}</span>
                  {g}
                </button>
              );
            })}
          </div>

          {/* Active group accent bar */}
          <div style={{
            height: 3,
            background: `linear-gradient(90deg, ${meta.color} 0%, transparent 100%)`,
            opacity: 0.6,
          }} />

          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 68px 68px 68px 68px",
            gap: 10,
            padding: "14px 32px 10px",
            borderBottom: "1px solid var(--c-border-strong)",
          }}>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--c-text-dim)",
            }}>Stat</div>
            {POSITIONS.map(p => (
              <div key={p} style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--c-text-dim)",
                textAlign: "center",
              }}>{p}</div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ padding: "8px 24px 8px" }}>
            {filteredCategories.map((cat, idx) => {
              const vals = scores[cat.label] || {};
              return (
                <div key={cat.label} className="row-wrap" style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 68px 68px 68px 68px",
                  gap: 10,
                  padding: "9px 8px",
                  alignItems: "center",
                  borderBottom: idx < filteredCategories.length - 1 ? "1px solid var(--c-border)" : "none",
                  transition: "background 0.15s",
                }}>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    color: "var(--c-text)",
                    fontWeight: 400,
                  }}>{cat.label}</span>
                  {POSITIONS.map(pos => {
                    const v = vals[pos];
                    const num = parseFloat(String(v));
                    const cls = `score-input${num < 0 ? " neg" : num > 0 ? " pos" : " zero"}`;
                    return (
                      <input
                        key={pos}
                        className={cls}
                        value={v ?? 0}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateScore(cat.label, pos, e.target.value)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            padding: "20px 32px",
            borderTop: "1px solid var(--c-border-strong)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--c-bg)",
          }}>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: "var(--c-text-dim)",
              letterSpacing: "0.06em",
            }}>
              <span style={{ color: meta.color, marginRight: 4 }}>{meta.icon}</span>
              {filteredCategories.length} stats in {activeGroup} · {SCORING_CATEGORIES.length} total
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="reset-btn" onClick={handleReset}>Reset</button>
              <button
                className={`save-btn${saved ? " saved" : ""}`}
                onClick={handleSave}
              >
                {saved ? "✓ Saved!" : "Save Matrix"}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div style={{
          marginTop: 32,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {["Attacking","Passing","Appearance","Defensive","Discipline"].map(g => (
              <div key={g} style={{
                width: 10, height: 10, borderRadius: "50%",
                background: GROUP_META[g].color,
                opacity: activeGroup === g ? 1 : 0.25,
                transition: "opacity 0.2s",
              }} />
            ))}
          </div>
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "var(--c-text-dim)",
            letterSpacing: "0.1em",
          }}>CURTIS · Draft Football · 2025/26</span>
        </div>

      </div>
    </div>
  );
}
