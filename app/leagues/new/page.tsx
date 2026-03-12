"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavBar } from "@/components/NavBar";
import { useIsMobile } from "@/lib/use-is-mobile";

// ─── DATA ────────────────────────────────────────────────────────────────────

const SCORING_CATEGORIES = [
  { label: "Goal",                group: "Attacking",  icon: "⚽" },
  { label: "Assist",              group: "Attacking",  icon: "🎯" },
  { label: "Key Pass",            group: "Attacking",  icon: "◎" },
  { label: "Shot on Target",      group: "Attacking",  icon: "▶" },
  { label: "Big Chance Created",  group: "Attacking",  icon: "⚡" },
  { label: "Big Chance Missed",   group: "Attacking",  icon: "✕" },
  { label: "40+ Passes @ 80%",    group: "Passing",    icon: "◎" },
  { label: "50+ Passes @ 80%",    group: "Passing",    icon: "◎" },
  { label: "60+ Passes @ 80%",    group: "Passing",    icon: "◎" },
  { label: "Corner Kick Won",     group: "Passing",    icon: "⌐" },
  { label: "1–60 Min Played",     group: "Appearance", icon: "◷" },
  { label: "61–89 Min Played",    group: "Appearance", icon: "◷" },
  { label: "90+ Min Played",      group: "Appearance", icon: "◷" },
  { label: "Tackle Won",          group: "Defensive",  icon: "⬡" },
  { label: "Interception",        group: "Defensive",  icon: "🛡" },
  { label: "Clean Sheet",         group: "Defensive",  icon: "✦" },
  { label: "Goal Conceded",       group: "Defensive",  icon: "▼" },
  { label: "Save",                group: "Defensive",  icon: "🧤" },
  { label: "Penalty Save",        group: "Defensive",  icon: "★" },
  { label: "Defensive Error",     group: "Defensive",  icon: "▲" },
  { label: "Yellow Card",         group: "Discipline", icon: "🟨" },
  { label: "Red Card",            group: "Discipline", icon: "🟥" },
  { label: "Own Goal",            group: "Discipline", icon: "↩" },
  { label: "Penalty Missed",      group: "Discipline", icon: "✕" },
  { label: "Penalty Conceded",    group: "Discipline", icon: "▼" },
  { label: "Turnover",            group: "Discipline", icon: "↩" },
];

type ScoreValues = Record<string, Record<string, number | string>>;

const DEFAULT_SCORES: ScoreValues = {
  "Goal":               { FWD: 5,    MID: 6,    DEF: 7,    GK: 8    },
  "Assist":             { FWD: 2.5,  MID: 3,    DEF: 3.5,  GK: 4    },
  "Key Pass":           { FWD: 1,    MID: 1,    DEF: 1,    GK: 1    },
  "Shot on Target":     { FWD: 0.5,  MID: 0.5,  DEF: 0.5,  GK: 0.5  },
  "Big Chance Created": { FWD: 1,    MID: 1,    DEF: 1,    GK: 1    },
  "Big Chance Missed":  { FWD: -0.5, MID: -0.5, DEF: -0.5, GK: -0.5 },
  "40+ Passes @ 80%":   { FWD: 4,    MID: 4,    DEF: 4,    GK: 4    },
  "50+ Passes @ 80%":   { FWD: 4.5,  MID: 4.5,  DEF: 4.5,  GK: 4.5  },
  "60+ Passes @ 80%":   { FWD: 5,    MID: 5,    DEF: 5,    GK: 5    },
  "Corner Kick Won":    { FWD: 0.5,  MID: 0.5,  DEF: 0.5,  GK: 0.5  },
  "1–60 Min Played":    { FWD: 1,    MID: 1,    DEF: 1,    GK: 1    },
  "61–89 Min Played":   { FWD: 2,    MID: 2,    DEF: 2,    GK: 2    },
  "90+ Min Played":     { FWD: 3,    MID: 3,    DEF: 3,    GK: 3    },
  "Tackle Won":         { FWD: 0.5,  MID: 0.5,  DEF: 0.5,  GK: 0.5  },
  "Interception":       { FWD: 0.5,  MID: 0.5,  DEF: 0.5,  GK: 0.5  },
  "Clean Sheet":        { FWD: 0,    MID: 2,    DEF: 5,    GK: 5    },
  "Goal Conceded":      { FWD: 0,    MID: -0.5, DEF: -1,   GK: -1   },
  "Save":               { FWD: 0,    MID: 0,    DEF: 0,    GK: 0.5  },
  "Penalty Save":       { FWD: 0,    MID: 0,    DEF: 0,    GK: 2    },
  "Defensive Error":    { FWD: -0.5, MID: -0.5, DEF: -0.5, GK: -0.5 },
  "Yellow Card":        { FWD: -2,   MID: -2,   DEF: -2,   GK: -2   },
  "Red Card":           { FWD: -4,   MID: -4,   DEF: -4,   GK: -4   },
  "Own Goal":           { FWD: -2,   MID: -2,   DEF: -2,   GK: -2   },
  "Penalty Missed":     { FWD: -2,   MID: -2,   DEF: -2,   GK: -2   },
  "Penalty Conceded":   { FWD: -1,   MID: -1,   DEF: -1,   GK: -1   },
  "Turnover":           { FWD: 0,    MID: 0,    DEF: 0,    GK: 0    },
};

const GROUPS = ["Attacking","Passing","Appearance","Defensive","Discipline"];
const GROUP_META: Record<string, { color: string; light: string }> = {
  Attacking:  { color: "#FF5A1F", light: "#FFF1EC" },
  Passing:    { color: "#D97706", light: "#FFFBEB" },
  Appearance: { color: "#7C6F5B", light: "#F7F4EF" },
  Defensive:  { color: "#2D6A4F", light: "#ECFDF5" },
  Discipline: { color: "#9B1C1C", light: "#FEF2F2" },
};
const POSITIONS = ["FWD","MID","DEF","GK"];

const STEPS = [
  { id: 1, label: "Basics",   icon: "◆", desc: "Name your league" },
  { id: 2, label: "Teams",    icon: "⬡", desc: "Size & structure"  },
  { id: 3, label: "Draft",    icon: "◎", desc: "Draft settings"    },
  { id: 4, label: "Scoring",  icon: "⚡", desc: "Points matrix"    },
  { id: 5, label: "Launch",   icon: "★", desc: "Review & create"   },
];

const PICK_TIMES   = ["30s", "60s", "90s", "120s", "No Limit"];
const FORMATIONS   = ["Any", "4-4-2", "4-3-3", "3-5-2", "4-5-1", "5-3-2"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:48 }}>
      {STEPS.map((s, i) => {
        const done    = step > s.id;
        const active  = step === s.id;
        return (
          <div key={s.id} style={{ display:"flex", alignItems:"center", flex: i < STEPS.length-1 ? 1 : 0 }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
              <div style={{
                width:40, height:40, borderRadius:12,
                background: done ? "#FF5A1F" : active ? "var(--c-text)" : "var(--c-skeleton)",
                border: active ? "2px solid #FF5A1F" : "2px solid transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.3s",
                boxShadow: active ? "0 0 0 4px rgba(255,90,31,0.15)" : "none",
              }}>
                {done
                  ? <span style={{color:"white",fontSize:14}}>✓</span>
                  : <span style={{color: active ? "white" : "var(--c-text-muted)", fontSize:15}}>{s.icon}</span>
                }
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{
                  fontFamily:"'DM Mono', monospace", fontSize:9,
                  letterSpacing:"0.1em", textTransform:"uppercase",
                  color: active ? "#FF5A1F" : done ? "var(--c-text)" : "var(--c-text-dim)",
                  fontWeight: active ? 500 : 400,
                }}>{s.label}</div>
              </div>
            </div>
            {i < STEPS.length-1 && (
              <div style={{
                flex:1, height:2, margin:"0 8px", marginBottom:22,
                background: done ? "#FF5A1F" : "var(--c-border-strong)",
                transition:"background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OptionCard({ label, sub, selected, onClick, icon }: {
  label: string; sub?: string; selected: boolean; onClick: () => void; icon?: string;
}) {
  return (
    <div onClick={onClick} style={{
      padding:"16px 18px", borderRadius:12, cursor:"pointer",
      border: `2px solid ${selected ? "#FF5A1F" : "var(--c-border-strong)"}`,
      background: selected ? "var(--c-accent-dim)" : "var(--c-bg-elevated)",
      transition:"all 0.18s",
      boxShadow: selected ? "0 4px 16px rgba(255,90,31,0.12)" : "none",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {icon && <span style={{ fontSize:20 }}>{icon}</span>}
        <div>
          <div style={{
            fontFamily:"'DM Sans', sans-serif", fontSize:14, fontWeight:600,
            color: selected ? "#FF5A1F" : "var(--c-text)",
          }}>{label}</div>
          {sub && <div style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"var(--c-text-muted)", marginTop:2, letterSpacing:"0.04em" }}>{sub}</div>}
        </div>
        <div style={{ marginLeft:"auto" }}>
          <div style={{
            width:18, height:18, borderRadius:"50%",
            border:`2px solid ${selected ? "#FF5A1F" : "var(--c-border-strong)"}`,
            background: selected ? "#FF5A1F" : "transparent",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {selected && <span style={{color:"white",fontSize:10}}>✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberStepper({ value, min, max, onChange, label, unit="" }: {
  value: number; min: number; max: number; onChange: (v: number) => void; label: string; unit?: string;
}) {
  return (
    <div style={{ background:"var(--c-bg-elevated)", border:"1.5px solid var(--c-border-strong)", borderRadius:12, padding:"16px 20px" }}>
      <div style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--c-text-muted)", marginBottom:10 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        <button onClick={() => onChange(Math.max(min, value-1))} style={{
          width:36, height:36, borderRadius:9, border:"1.5px solid var(--c-border-strong)",
          background:"var(--c-bg)", cursor:"pointer", fontSize:18, color:"var(--c-text-muted)",
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all 0.15s",
        }}>−</button>
        <div style={{ fontFamily:"'Playfair Display', serif", fontSize:32, fontWeight:900, color:"var(--c-text)", minWidth:40, textAlign:"center" }}>
          {value}<span style={{ fontSize:14, color:"var(--c-text-muted)", fontFamily:"'DM Mono', monospace" }}>{unit}</span>
        </div>
        <button onClick={() => onChange(Math.min(max, value+1))} style={{
          width:36, height:36, borderRadius:9, border:"1.5px solid var(--c-border-strong)",
          background:"var(--c-bg)", cursor:"pointer", fontSize:18, color:"#FF5A1F",
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all 0.15s",
        }}>+</button>
      </div>
    </div>
  );
}

// ─── STEP COMPONENTS ─────────────────────────────────────────────────────────

type BasicsData = { name: string; teamName: string; privacy: string; format: string; };
type TeamsData = { teams: number; squadSize: number; startingXI: number; bench: number; formation: string; transfers: string; };
type DraftData = { draftType: string; pickTime: string; autopick: string; };
type ScoringData = { scores: ScoreValues };

function StepBasics({ data, set }: { data: BasicsData; set: (d: BasicsData) => void }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <label style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--c-text-muted)", display:"block", marginBottom:8 }}>
          League Name
        </label>
        <input
          value={data.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({...data, name: e.target.value})}
          placeholder="e.g. The Gaffer's Cup"
          style={{
            width:"100%", padding:"16px 18px",
            fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:700,
            border:"2px solid var(--c-input-border)", borderRadius:12, outline:"none",
            background:"var(--c-input)", color:"var(--c-text)",
            transition:"border-color 0.2s",
          }}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor="#FF5A1F"}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor="var(--c-input-border)"}
        />
      </div>

      <div>
        <label style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--c-text-muted)", display:"block", marginBottom:8 }}>
          Your Team Name
        </label>
        <input
          value={data.teamName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({...data, teamName: e.target.value})}
          placeholder="e.g. Interception FC"
          style={{
            width:"100%", padding:"14px 18px",
            fontFamily:"'DM Sans', sans-serif", fontSize:16,
            border:"2px solid var(--c-input-border)", borderRadius:12, outline:"none",
            background:"var(--c-input)", color:"var(--c-text)",
            transition:"border-color 0.2s",
          }}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor="#FF5A1F"}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor="var(--c-input-border)"}
        />
      </div>

      <div>
        <label style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--c-text-muted)", display:"block", marginBottom:10 }}>
          Privacy
        </label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <OptionCard
            label="Private League"
            sub="Invite only via link"
            icon="🔒"
            selected={data.privacy === "private"}
            onClick={() => set({...data, privacy:"private"})}
          />
          <OptionCard
            label="Public League"
            sub="Anyone can join & discover"
            icon="🌍"
            selected={data.privacy === "public"}
            onClick={() => set({...data, privacy:"public"})}
          />
        </div>
      </div>

      <div>
        <label style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--c-text-muted)", display:"block", marginBottom:10 }}>
          League Format
        </label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <OptionCard
            label="Head-to-Head"
            sub="Weekly matchups, win/lose/draw"
            icon="⚔️"
            selected={data.format === "h2h"}
            onClick={() => set({...data, format:"h2h"})}
          />
          <OptionCard
            label="Points League"
            sub="Season total, ranked by points"
            icon="📊"
            selected={data.format === "points"}
            onClick={() => set({...data, format:"points"})}
          />
        </div>
      </div>
    </div>
  );
}

function StepTeams({ data, set }: { data: TeamsData; set: (d: TeamsData) => void }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <NumberStepper label="Number of Teams" value={data.teams} min={4} max={20} onChange={v => set({...data, teams:v})} />
        <NumberStepper label="Squad Size" value={data.squadSize} min={11} max={25} onChange={v => set({...data, squadSize:v})} unit=" players" />
        <NumberStepper label="Starting XI" value={data.startingXI} min={11} max={11} onChange={v => set({...data, startingXI:v})} unit=" players" />
        <NumberStepper label="Bench Size" value={data.bench} min={0} max={10} onChange={v => set({...data, bench:v})} />
      </div>

      <div>
        <label style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--c-text-muted)", display:"block", marginBottom:10 }}>
          Formation Rules
        </label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {FORMATIONS.map(f => (
            <OptionCard key={f} label={f} selected={data.formation === f} onClick={() => set({...data, formation:f})} />
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--c-text-muted)", display:"block", marginBottom:10 }}>
          Transfers
        </label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <OptionCard label="No Transfers" sub="Draft-only, locked all season" icon="🔐" selected={data.transfers === "none"} onClick={() => set({...data, transfers:"none"})} />
          <OptionCard label="Waiver Wire" sub="Weekly priority-based claims" icon="🔄" selected={data.transfers === "waiver"} onClick={() => set({...data, transfers:"waiver"})} />
          <OptionCard label="Free Agency" sub="First-come, first-served" icon="⚡" selected={data.transfers === "free"} onClick={() => set({...data, transfers:"free"})} />
          <OptionCard label="Trade Window" sub="Manager-to-manager trades" icon="🤝" selected={data.transfers === "trade"} onClick={() => set({...data, transfers:"trade"})} />
        </div>
      </div>
    </div>
  );
}

function StepDraft({ data, set }: { data: DraftData; set: (d: DraftData) => void }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <label style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--c-text-muted)", display:"block", marginBottom:10 }}>
          Draft Type
        </label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { id:"snake",   label:"Snake Draft",   sub:"Reverses order each round — most balanced",  icon:"🐍" },
            { id:"linear",  label:"Linear Draft",  sub:"Same order every round — simplest",          icon:"→"  },
            { id:"auction", label:"Auction Draft",  sub:"Budget-based bidding — most strategic",      icon:"🏦" },
            { id:"rsnake",  label:"Rand. Snake",    sub:"Random order revealed on draft day",         icon:"🎲" },
          ].map(o => (
            <OptionCard key={o.id} label={o.label} sub={o.sub} icon={o.icon}
              selected={data.draftType === o.id}
              onClick={() => set({...data, draftType:o.id})} />
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--c-text-muted)", display:"block", marginBottom:10 }}>
          Time Per Pick
        </label>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {PICK_TIMES.map(t => (
            <button key={t} onClick={() => set({...data, pickTime:t})} style={{
              padding:"10px 20px", borderRadius:10,
              border:`2px solid ${data.pickTime === t ? "#FF5A1F" : "var(--c-input-border)"}`,
              background: data.pickTime === t ? "#FF5A1F" : "var(--c-bg-elevated)",
              color: data.pickTime === t ? "white" : "var(--c-text-muted)",
              fontFamily:"'DM Mono', monospace", fontSize:12,
              cursor:"pointer", transition:"all 0.15s",
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--c-text-muted)", display:"block", marginBottom:10 }}>
          Autopick if Time Expires
        </label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <OptionCard label="Best Available" sub="Highest ranked player auto-selected" icon="🤖" selected={data.autopick === "best"} onClick={() => set({...data, autopick:"best"})} />
          <OptionCard label="Skip Turn" sub="Manager loses the pick" icon="⏭" selected={data.autopick === "skip"} onClick={() => set({...data, autopick:"skip"})} />
        </div>
      </div>

      <div style={{ background:"var(--c-accent-dim)", borderRadius:12, padding:"16px 18px", border:"1.5px solid #FDDCCC" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
          <span style={{ fontSize:18, marginTop:1 }}>💡</span>
          <div>
            <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:600, color:"#C2410C", marginBottom:3 }}>The Curtis Advantage</p>
            <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:"#92400E", lineHeight:1.5 }}>
              Snake draft is recommended. With {data.draftType === "auction" ? "auction" : "snake"} drafting, every manager owns a unique version of each player — meaning Curtis Davies&apos; interceptions only win points for <em>one</em> team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepScoring({ data, set }: { data: ScoringData; set: (d: ScoringData) => void }) {
  const [activeGroup, setActiveGroup] = useState("Attacking");
  const filtered = SCORING_CATEGORIES.filter(c => c.group === activeGroup);
  const meta = GROUP_META[activeGroup];

  const updateScore = (label: string, pos: string, val: string) => {
    const updated = {
      ...data.scores,
      [label]: { ...data.scores[label], [pos]: val }
    };
    set({...data, scores: updated});
  };

  const resetGroup = () => {
    const updated = { ...data.scores };
    filtered.forEach(c => { updated[c.label] = { ...DEFAULT_SCORES[c.label] }; });
    set({...data, scores: updated});
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {/* Preset strip */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {[
          { label:"CURTIS Default", desc:"Our recommended balanced scoring" },
          { label:"Goals Heavy",    desc:"Attackers dominate, defenders minimal" },
          { label:"Stats Nerd",     desc:"Every touch rewarded equally" },
          { label:"Classic FPL",    desc:"Familiar to FPL managers" },
        ].map(p => (
          <button key={p.label} onClick={() => set({...data, scores:{...DEFAULT_SCORES}})} style={{
            padding:"8px 14px", borderRadius:8,
            border:"1.5px solid var(--c-border-strong)", background:"var(--c-bg-elevated)",
            fontFamily:"'DM Mono', monospace", fontSize:10,
            letterSpacing:"0.06em", color:"var(--c-text-muted)", cursor:"pointer",
            transition:"all 0.15s",
          }}
          onMouseOver={(e: React.MouseEvent<HTMLButtonElement>) => {(e.currentTarget as HTMLButtonElement).style.borderColor="#FF5A1F";(e.currentTarget as HTMLButtonElement).style.color="#FF5A1F"}}
          onMouseOut={(e: React.MouseEvent<HTMLButtonElement>) => {(e.currentTarget as HTMLButtonElement).style.borderColor="var(--c-border-strong)";(e.currentTarget as HTMLButtonElement).style.color="var(--c-text-muted)"}}
          >{p.label}</button>
        ))}
      </div>

      {/* Group tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:0, flexWrap:"wrap" }}>
        {GROUPS.map(g => {
          const m = GROUP_META[g];
          const isActive = activeGroup === g;
          return (
            <button key={g} onClick={() => setActiveGroup(g)} style={{
              padding:"8px 16px", borderRadius:"10px 10px 0 0",
              border:`1.5px solid ${isActive ? m.color : "var(--c-border-strong)"}`,
              borderBottom: isActive ? `1.5px solid var(--c-bg-elevated)` : `1.5px solid var(--c-border-strong)`,
              background: isActive ? "var(--c-bg-elevated)" : "var(--c-bg)",
              fontFamily:"'DM Mono', monospace", fontSize:10,
              letterSpacing:"0.08em", textTransform:"uppercase",
              color: isActive ? m.color : "var(--c-text-muted)",
              cursor:"pointer", transition:"all 0.15s",
              marginBottom: isActive ? "-1.5px" : 0,
              zIndex: isActive ? 2 : 1, position:"relative",
            }}>{g}</button>
          );
        })}
      </div>

      {/* Table card */}
      <div style={{
        background:"var(--c-bg-elevated)", borderRadius:"0 12px 12px 12px",
        border:`1.5px solid ${meta.color}`,
        overflow:"hidden", position:"relative", zIndex:1,
      }}>
        {/* Col headers */}
        <div style={{
          display:"grid", gridTemplateColumns:"1fr 64px 64px 64px 64px 90px",
          gap:8, padding:"12px 20px 10px",
          borderBottom:"1px solid var(--c-border)",
          background: meta.light,
        }}>
          <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color: meta.color }}>Stat</span>
          {POSITIONS.map(p => (
            <span key={p} style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color: meta.color, textAlign:"center" }}>{p}</span>
          ))}
          <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color: meta.color, textAlign:"center" }}>Same All</span>
        </div>

        {/* Rows */}
        <div style={{ padding:"6px 12px 10px" }}>
          {filtered.map((cat, idx) => {
            const vals = data.scores[cat.label] || {};
            const allSame = POSITIONS.every(p => String(vals[p]) === String(vals.FWD));
            return (
              <div key={cat.label} style={{
                display:"grid", gridTemplateColumns:"1fr 64px 64px 64px 64px 90px",
                gap:8, padding:"8px 8px", alignItems:"center",
                borderBottom: idx < filtered.length-1 ? "1px solid var(--c-border)" : "none",
                borderRadius:6,
              }}>
                <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:"var(--c-text-muted)", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12 }}>{cat.icon}</span>
                  {cat.label}
                </span>
                {POSITIONS.map(pos => {
                  const v = vals[pos];
                  const num = parseFloat(String(v));
                  return (
                    <input key={pos} value={v ?? 0}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateScore(cat.label, pos, e.target.value)}
                      style={{
                        width:"100%", padding:"7px 4px", textAlign:"center",
                        fontFamily:"'DM Mono', monospace", fontSize:12,
                        border:`1.5px solid var(--c-input-border)`, borderRadius:7, outline:"none",
                        background:"var(--c-input)",
                        color: num < 0 ? "#B91C1C" : num > 0 ? "#166534" : "var(--c-text-dim)",
                        transition:"all 0.15s",
                      }}
                      onFocus={(e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = meta.color; e.target.style.boxShadow = `0 0 0 2px ${meta.color}22`; }}
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = "var(--c-input-border)"; e.target.style.boxShadow = "none"; }}
                    />
                  );
                })}
                {/* Same all toggle */}
                <button onClick={() => {
                  const fwdVal = vals.FWD;
                  const updated = { ...data.scores, [cat.label]: { FWD:fwdVal, MID:fwdVal, DEF:fwdVal, GK:fwdVal } };
                  set({...data, scores:updated});
                }} style={{
                  padding:"6px 10px", borderRadius:7,
                  border:`1.5px solid ${allSame ? meta.color : "var(--c-border-strong)"}`,
                  background: allSame ? meta.light : "var(--c-bg-elevated)",
                  fontFamily:"'DM Mono', monospace", fontSize:9,
                  color: allSame ? meta.color : "var(--c-text-dim)",
                  cursor:"pointer", letterSpacing:"0.06em", textTransform:"uppercase",
                  transition:"all 0.15s",
                }}>
                  {allSame ? "✓ Equal" : "Set Equal"}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{
          padding:"12px 20px", borderTop:"1px solid #F5EFE8",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          background: meta.light,
        }}>
          <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color: meta.color, letterSpacing:"0.08em" }}>
            {filtered.length} stats in {activeGroup}
          </span>
          <button onClick={resetGroup} style={{
            fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.08em",
            textTransform:"uppercase", background:"none", border:"none",
            color: meta.color, cursor:"pointer", textDecoration:"underline",
          }}>Reset {activeGroup}</button>
        </div>
      </div>
    </div>
  );
}

function StepReview({ data }: { data: { basics: BasicsData; teams: TeamsData; draft: DraftData; scores: ScoreValues } }) {
  const totalStats = SCORING_CATEGORIES.length;
  const customised = SCORING_CATEGORIES.filter(c => {
    const def = DEFAULT_SCORES[c.label];
    const cur = data.scores[c.label];
    return def && cur && POSITIONS.some(p => String(def[p]) !== String(cur[p]));
  }).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Summary blocks */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[
          { label:"League",    value: data.basics.name || "Unnamed League",         sub: data.basics.format === "h2h" ? "Head-to-Head" : "Points League" },
          { label:"Your Team", value: data.basics.teamName || "My Team",             sub: data.basics.privacy === "private" ? "Private · Invite Only" : "Public League" },
          { label:"Teams",     value: `${data.teams.teams} Teams`,                   sub: `${data.teams.squadSize} players per squad · ${data.teams.bench} bench` },
          { label:"Draft",     value: data.draft.draftType === "snake" ? "Snake Draft" : data.draft.draftType === "auction" ? "Auction" : data.draft.draftType === "linear" ? "Linear" : "Random Snake", sub: `${data.draft.pickTime} per pick · ${data.draft.autopick === "best" ? "Autopick best" : "Skip on expire"}` },
          { label:"Transfers", value: ({ none:"No Transfers", waiver:"Waiver Wire", free:"Free Agency", trade:"Trade Window" } as Record<string,string>)[data.teams.transfers] || "None", sub:"Season format" },
          { label:"Scoring",   value: `${totalStats} Stats`,                         sub: customised > 0 ? `${customised} customised from default` : "CURTIS default scoring" },
        ].map(s => (
          <div key={s.label} style={{ background:"var(--c-bg-elevated)", border:"1.5px solid var(--c-border-strong)", borderRadius:12, padding:"16px 18px" }}>
            <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--c-text-dim)", marginBottom:5 }}>{s.label}</p>
            <p style={{ fontFamily:"'Playfair Display', serif", fontSize:17, fontWeight:700, color:"var(--c-text)", marginBottom:2 }}>{s.value}</p>
            <p style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"var(--c-text-muted)", letterSpacing:"0.04em" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Invite section */}
      <div style={{ background:"linear-gradient(135deg, #1C1410 0%, #3D2E22 100%)", borderRadius:14, padding:"22px 24px" }}>
        <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(255,255,255,0.4)", marginBottom:6 }}>Invite Link (generated on creation)</p>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <div style={{
            flex:1, padding:"11px 14px", borderRadius:9,
            background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
            fontFamily:"'DM Mono', monospace", fontSize:12, color:"rgba(255,255,255,0.4)",
            letterSpacing:"0.06em",
          }}>curtis.gg/league/••••••••</div>
          <div style={{
            padding:"11px 18px", borderRadius:9,
            background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)",
            fontFamily:"'DM Mono', monospace", fontSize:11, color:"rgba(255,255,255,0.5)",
            cursor:"pointer", letterSpacing:"0.06em",
          }}>Copy</div>
        </div>
      </div>

      {/* Curtis stamp */}
      <div style={{ background:"var(--c-accent-dim)", border:"1.5px solid #FDDCCC", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:22 }}>◆</span>
        <div>
          <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:600, color:"#C2410C" }}>Ready to run the CURTIS way</p>
          <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:"#92400E" }}>Opta live feed · {totalStats} tracked stats · Every position rewarded</p>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function LeagueSetupPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [step, setStep] = useState(1);
  const [launched, setLaunched] = useState(false);

  const [basics, setBasics]   = useState<BasicsData>({ name:"", teamName:"", privacy:"private", format:"h2h" });
  const [teams,  setTeams]    = useState<TeamsData>({ teams:10, squadSize:15, startingXI:11, bench:4, formation:"Any", transfers:"waiver" });
  const [draft,  setDraft]    = useState<DraftData>({ draftType:"snake", pickTime:"60s", autopick:"best" });
  const [scoring, setScoring] = useState<ScoringData>({ scores:{ ...DEFAULT_SCORES } });

  const data = { basics, teams, draft, scores: scoring.scores };

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdLeague, setCreatedLeague] = useState<{
    id: string; name: string; invite_code: string;
  } | null>(null);

  async function handleLaunch() {
    if (!basics.name.trim() || !basics.teamName.trim()) return;
    setCreating(true);
    setCreateError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCreateError("You must be signed in to create a league.");
      setCreating(false);
      return;
    }

    const pickSeconds: Record<string, number> = {
      "30s": 30, "60s": 60, "90s": 90, "120s": 120, "No Limit": 0,
    };
    const draftTypeMap: Record<string, string> = {
      rsnake: "random_snake", snake: "snake", linear: "linear", auction: "auction",
    };

    // Ensure a profile row exists before inserting the league (FK requirement)
    await supabase.from("profiles").upsert(
      { id: user.id, email: user.email!, username: user.email!.split("@")[0] },
      { onConflict: "id", ignoreDuplicates: true }
    );

    const { data: league, error: leagueErr } = await supabase
      .from("leagues")
      .insert({
        name: basics.name.trim(),
        commissioner_id: user.id,
        format: basics.format,
        privacy: basics.privacy,
        season: "2025-26",
        max_teams: teams.teams,
        squad_size: teams.squadSize,
        bench_size: teams.bench,
        transfer_type: teams.transfers,
        draft_type: draftTypeMap[draft.draftType] ?? "snake",
        pick_time_seconds: pickSeconds[draft.pickTime] ?? 60,
        autopick: draft.autopick,
        draft_status: "pending",
      })
      .select("id, name, invite_code")
      .single();

    if (leagueErr || !league) {
      setCreateError(leagueErr?.message ?? "Failed to create league.");
      setCreating(false);
      return;
    }

    await supabase.from("teams").insert({
      league_id: league.id,
      user_id: user.id,
      name: basics.teamName.trim(),
      draft_position: 1,
    });

    const rulesRows = SCORING_CATEGORIES.map((cat) => ({
      league_id: league.id,
      stat_key: cat.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      stat_label: cat.label,
      stat_group: cat.group,
      fwd_pts: parseFloat(String(scoring.scores[cat.label]?.FWD ?? 0)) || 0,
      mid_pts: parseFloat(String(scoring.scores[cat.label]?.MID ?? 0)) || 0,
      def_pts: parseFloat(String(scoring.scores[cat.label]?.DEF ?? 0)) || 0,
      gk_pts: parseFloat(String(scoring.scores[cat.label]?.GK ?? 0)) || 0,
    }));
    await supabase.from("scoring_rules").insert(rulesRows);

    setCreatedLeague(league);
    setLaunched(true);
    setCreating(false);
  }

  const canAdvance = () => {
    if (step === 1) return basics.name.trim().length > 0 && basics.teamName.trim().length > 0;
    return true;
  };

  if (launched && createdLeague) {
    const inviteUrl = typeof window !== "undefined"
      ? `${window.location.origin}/join/${createdLeague.invite_code}`
      : `/join/${createdLeague.invite_code}`;

    return (
      <div style={{ minHeight:"100vh", background:"var(--c-bg)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:24, padding:"24px" }}>
        <div style={{
          width:80, height:80, borderRadius:20,
          background:"linear-gradient(135deg,#FF5A1F,#E8400A)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:36, boxShadow:"0 8px 32px rgba(255,90,31,0.4)",
        }}>◆</div>

        <div style={{ textAlign:"center", maxWidth:480 }}>
          <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:42, fontWeight:900, color:"var(--c-text)", marginBottom:8 }}>
            <span style={{ fontStyle:"italic", color:"#FF5A1F" }}>{createdLeague.name}</span> is live.
          </h1>
          <p style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:"var(--c-text-muted)", letterSpacing:"0.08em" }}>
            Share this link to invite your managers
          </p>
        </div>

        {/* Invite link card */}
        <div style={{ width:"100%", maxWidth:480, background:"#1C1410", borderRadius:16, padding:"20px 24px" }}>
          <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:10 }}>
            Invite Link
          </p>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{
              flex:1, padding:"10px 14px", borderRadius:8,
              background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
              fontFamily:"'DM Mono', monospace", fontSize:11, color:"rgba(255,255,255,0.6)",
              letterSpacing:"0.04em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            }}>
              {inviteUrl}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
              style={{
                padding:"10px 16px", borderRadius:8, border:"none",
                background:"#FF5A1F", color:"white",
                fontFamily:"'DM Mono', monospace", fontSize:11,
                letterSpacing:"0.07em", cursor:"pointer", flexShrink:0,
                transition:"background 0.15s",
              }}
            >
              Copy
            </button>
          </div>
          <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:"rgba(255,255,255,0.2)", marginTop:10, letterSpacing:"0.06em" }}>
            Code: {createdLeague.invite_code} · {teams.teams} manager slots
          </p>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => router.push(`/leagues/${createdLeague.id}/draft`)} style={{
            padding:"12px 24px", borderRadius:10, border:"none",
            background:"linear-gradient(135deg,#FF5A1F,#E8400A)",
            color:"white", fontFamily:"'DM Mono', monospace", fontSize:12,
            letterSpacing:"0.08em", cursor:"pointer",
            boxShadow:"0 4px 16px rgba(255,90,31,0.3)",
          }}>Go to Draft Room →</button>
          <button onClick={() => router.push("/")} style={{
            padding:"12px 24px", borderRadius:10,
            border:"1.5px solid var(--c-border-strong)", background:"var(--c-bg-elevated)",
            color:"var(--c-text-muted)", fontFamily:"'DM Mono', monospace", fontSize:12,
            letterSpacing:"0.08em", cursor:"pointer",
          }}>League Hub</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--c-bg)", color:"var(--c-text)", overflowX: "hidden" }}>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes pop { 0%{transform:scale(0.5);opacity:0} 80%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .step-body { animation: fadeUp 0.3s ease; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:var(--c-skeleton); border-radius:2px; }
      `}</style>

      <NavBar links={[]} showThemeToggle={true} right={<ThemeToggle size="sm" />} />

      <div style={{ maxWidth:680, margin:"0 auto", padding: isMobile ? "28px 16px 60px" : "48px 32px 80px" }}>

        <div style={{ marginBottom:40 }}>
          <p style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", color:"#FF5A1F", marginBottom:8 }}>
            Commissioner Setup
          </p>
          <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:34, fontWeight:900, letterSpacing:"-0.02em", lineHeight:1.1 }}>
            Build Your<br/>
            <span style={{ fontStyle:"italic", color:"#FF5A1F" }}>League.</span>
          </h1>
        </div>

        <Stepper step={step} />

        {/* Step card */}
        <div style={{
          background:"var(--c-bg-elevated)", borderRadius:20, border:"1.5px solid var(--c-border-strong)",
          padding: isMobile ? "24px 20px 20px" : "32px 32px 28px",
          boxShadow:"0 4px 24px rgba(28,20,16,0.06)",
          marginBottom:20,
        }}>
          <div style={{ marginBottom:24 }}>
            <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize: isMobile ? 18 : 22, fontWeight:900, color:"var(--c-text)", marginBottom:4 }}>
              {STEPS[step-1].label}
            </h2>
            <p style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"var(--c-text-muted)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
              {STEPS[step-1].desc}
            </p>
          </div>

          <div className="step-body">
            {step === 1 && <StepBasics data={basics} set={setBasics} />}
            {step === 2 && <StepTeams  data={teams}  set={setTeams}  />}
            {step === 3 && <StepDraft  data={draft}  set={setDraft}  />}
            {step === 4 && <StepScoring data={scoring} set={setScoring} />}
            {step === 5 && <StepReview data={data} />}
          </div>
        </div>

        {/* Nav buttons */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <button
            onClick={() => setStep(s => Math.max(1, s-1))}
            disabled={step === 1}
            style={{
              padding:"13px 28px", borderRadius:10,
              border:"1.5px solid var(--c-border-strong)", background:"var(--c-bg-elevated)",
              fontFamily:"'DM Mono', monospace", fontSize:12,
              letterSpacing:"0.08em", textTransform:"uppercase",
              color: step === 1 ? "var(--c-text-dim)" : "var(--c-text-muted)",
              cursor: step === 1 ? "default" : "pointer",
              transition:"all 0.15s",
              minHeight: 44, minWidth: 44,
            }}
          >← Back</button>

          <div style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"var(--c-text-dim)", letterSpacing:"0.06em" }}>
            {step} / {STEPS.length}
          </div>

          {step < 5
            ? <button
                onClick={() => canAdvance() && setStep(s => s+1)}
                style={{
                  padding:"13px 28px", borderRadius:10, border:"none",
                  background: canAdvance() ? "linear-gradient(135deg,#FF5A1F,#E8400A)" : "var(--c-skeleton)",
                  color: canAdvance() ? "white" : "var(--c-text-dim)",
                  fontFamily:"'DM Mono', monospace", fontSize:12,
                  letterSpacing:"0.08em", textTransform:"uppercase",
                  cursor: canAdvance() ? "pointer" : "default",
                  boxShadow: canAdvance() ? "0 4px 14px rgba(255,90,31,0.3)" : "none",
                  transition:"all 0.2s",
                  minHeight: 44, minWidth: 44,
                }}
              >Continue →</button>
            : <>
                {createError && (
                  <div style={{
                    fontFamily:"'DM Sans', sans-serif", fontSize:13, color:"#C0392B",
                    background:"#FDF2F2", border:"1px solid #F5C6C6",
                    borderRadius:8, padding:"10px 14px",
                  }}>{createError}</div>
                )}
                <button
                  onClick={handleLaunch}
                  disabled={creating}
                  style={{
                    padding:"13px 32px", borderRadius:10, border:"none",
                    background: creating ? "#E8A88A" : "linear-gradient(135deg,#FF5A1F,#E8400A)",
                    color:"white",
                    fontFamily:"'DM Mono', monospace", fontSize:12,
                    letterSpacing:"0.08em", textTransform:"uppercase",
                    cursor: creating ? "not-allowed" : "pointer",
                    boxShadow: creating ? "none" : "0 4px 16px rgba(255,90,31,0.35)",
                    transition:"all 0.2s",
                    minHeight: 44, minWidth: 44,
                  }}
                >{creating ? "Creating…" : "◆ Launch League"}</button>
              </>
          }
        </div>
      </div>
    </div>
  );
}
