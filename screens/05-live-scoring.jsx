import { useState, useEffect } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const FIXTURES = [
  { home: "ARS", away: "CHE", hs: 2, as: 1, min: 67, status: "live"     },
  { home: "LIV", away: "MCI", hs: 1, as: 1, min: 34, status: "live"     },
  { home: "TOT", away: "NEW", hs: 0, as: 0, min: 12, status: "live"     },
  { home: "EVE", away: "BRE", hs: 1, as: 2, min: 90, status: "complete" },
  { home: "AVL", away: "WOL", hs: 3, as: 0, min: 78, status: "live"     },
  { home: "WHU", away: "MUN", hs: null, as: null, min: 0, status: "upcoming", kickoff: "17:30" },
];

const MY_PLAYERS = [
  { id:1,  name:"Pickford",         short:"Pickford",   club:"EVE", pos:"GK",  pts:9,   events:[{icon:"🧤",text:"Save",pts:0.5},{icon:"✦",text:"Clean Sheet HT",pts:5}],           starting:true,  row:0 },
  { id:2,  name:"Alexander-Arnold", short:"Trent",      club:"LIV", pos:"DEF", pts:11,  events:[{icon:"🎯",text:"Assist",pts:3.5},{icon:"◷",text:"90 mins",pts:3}],                starting:true,  row:1 },
  { id:3,  name:"Davies C",         short:"Davies C",   club:"BOU", pos:"DEF", pts:17,  events:[{icon:"🛡","text":"4 Interceptions",pts:2},{icon:"⬡",text:"3 Tackles",pts:1.5},{icon:"✦",text:"Clean Sheet",pts:5}], starting:true, row:1, hero:true },
  { id:4,  name:"Gvardiol",         short:"Gvardiol",   club:"MCI", pos:"DEF", pts:6,   events:[{icon:"◷",text:"90 mins",pts:3}],                                                   starting:true,  row:1 },
  { id:5,  name:"Salah",            short:"Salah",      club:"LIV", pos:"MID", pts:22,  events:[{icon:"⚽",text:"Goal",pts:6},{icon:"🎯",text:"Assist",pts:3},{icon:"◷",text:"90 mins",pts:3}], starting:true, row:2 },
  { id:6,  name:"Palmer",           short:"Palmer",     club:"CHE", pos:"MID", pts:11,  events:[{icon:"⚽",text:"Goal",pts:6},{icon:"◷",text:"90 mins",pts:3}],                     starting:true,  row:2 },
  { id:7,  name:"Mbeumo",           short:"Mbeumo",     club:"BRE", pos:"MID", pts:8,   events:[{icon:"🎯",text:"Assist",pts:2},{icon:"◎",text:"Key Pass ×2",pts:2}],               starting:true,  row:2 },
  { id:8,  name:"Nørgaard",         short:"Nørgaard",   club:"BRE", pos:"MID", pts:7,   events:[{icon:"⬡",text:"5 Tackles",pts:2.5},{icon:"🛡",text:"2 Interceptions",pts:1}],      starting:true,  row:2 },
  { id:9,  name:"Watkins",          short:"Watkins",    club:"AVL", pos:"FWD", pts:14,  events:[{icon:"⚽",text:"Goal",pts:5},{icon:"⚽",text:"Goal",pts:5},{icon:"◷",text:"90 mins",pts:3}], starting:true, row:3 },
  { id:10, name:"Haaland",          short:"Haaland",    club:"MCI", pos:"FWD", pts:7,   events:[{icon:"⚽",text:"Goal",pts:5}],                                                     starting:true,  row:3 },
  { id:11, name:"Isak",             short:"Isak",       club:"NEW", pos:"FWD", pts:3,   events:[{icon:"◷",text:"61 mins",pts:2}],                                                   starting:true,  row:3 },
];

const OPP_PLAYERS = [
  { id:21, name:"Raya",         club:"ARS", pos:"GK",  pts:8  },
  { id:22, name:"Pedro Porro",  club:"TOT", pos:"DEF", pts:4  },
  { id:23, name:"Saliba",       club:"ARS", pos:"DEF", pts:12 },
  { id:24, name:"Timber",       club:"ARS", pos:"DEF", pts:9  },
  { id:25, name:"Saka",         club:"ARS", pos:"MID", pts:18 },
  { id:26, name:"Fernandes",    club:"MUN", pos:"MID", pts:6  },
  { id:27, name:"Andreas",      club:"FUL", pos:"MID", pts:11 },
  { id:28, name:"Gallagher",    club:"AVL", pos:"MID", pts:7  },
  { id:29, name:"Cunha",        club:"WOL", pos:"FWD", pts:9  },
  { id:30, name:"Isak",         club:"NEW", pos:"FWD", pts:5  },
  { id:31, name:"Jackson",      club:"CHE", pos:"FWD", pts:4  },
];

const LIVE_FEED = [
  { time:"67'", player:"Watkins",   event:"Goal!",              pts:"+5",  pos:"FWD", mine:true,  icon:"⚽" },
  { time:"64'", player:"Saka",      event:"Assist",             pts:"+3",  pos:"MID", mine:false, icon:"🎯" },
  { time:"61'", player:"Davies C",  event:"4th Interception",   pts:"+0.5",pos:"DEF", mine:true,  icon:"🛡", hero:true },
  { time:"58'", player:"Salah",     event:"Goal!",              pts:"+6",  pos:"MID", mine:true,  icon:"⚽" },
  { time:"51'", player:"Nørgaard",  event:"5th Tackle Won",     pts:"+0.5",pos:"MID", mine:true,  icon:"⬡" },
  { time:"45'", player:"Pickford",  event:"Clean Sheet at HT",  pts:"+5",  pos:"GK",  mine:true,  icon:"✦" },
  { time:"38'", player:"Palmer",    event:"Goal!",              pts:"+6",  pos:"MID", mine:true,  icon:"⚽" },
  { time:"31'", player:"Saliba",    event:"Clean Sheet (HT)",   pts:"+5",  pos:"DEF", mine:false, icon:"✦" },
  { time:"22'", player:"Trent",     event:"Assist",             pts:"+3.5",pos:"DEF", mine:true,  icon:"🎯" },
];

const POS_META = {
  GK:  { color:"#92400E", bg:"#FEF9C3" },
  DEF: { color:"#1E40AF", bg:"#DBEAFE" },
  MID: { color:"#6B21A8", bg:"#F3E8FF" },
  FWD: { color:"#C2410C", bg:"#FFF1EC" },
};

const CLUB_COLORS = {
  LIV:"#C8102E", ARS:"#EF0107", MCI:"#6CABDD", CHE:"#034694",
  AVL:"#670E36", BRE:"#E30613", TOT:"#132257", EVE:"#003399",
  NEW:"#241F20", FUL:"#CC0000", MUN:"#DA291C", BOU:"#DA291C",
  WHU:"#7A263A", WOL:"#FDB913",
};

// ─── PITCH LAYOUT ─────────────────────────────────────────────────────────────
// Groups players into rows: GK → DEF → MID → FWD
function PitchView({ players, isOpponent = false }) {
  const rows = [
    players.filter(p => p.pos === "GK"),
    players.filter(p => p.pos === "DEF"),
    players.filter(p => p.pos === "MID"),
    players.filter(p => p.pos === "FWD"),
  ];
  if (isOpponent) rows.reverse();

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      justifyContent: "space-around", padding: "12px 8px", gap: 6,
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
          {row.map(p => (
            <PlayerToken key={p.id} player={p} isOpponent={isOpponent} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PlayerToken({ player, isOpponent }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (player.hero) {
      const t = setInterval(() => setPulse(p => !p), 1800);
      return () => clearInterval(t);
    }
  }, []);

  const isHighScore = player.pts >= 15;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
      cursor: "pointer",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: isOpponent
          ? "rgba(255,255,255,0.06)"
          : player.hero
            ? `linear-gradient(135deg, #FF5A1F, #E8400A)`
            : "rgba(255,255,255,0.1)",
        border: `2px solid ${player.hero ? "#FF5A1F" : isHighScore ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        boxShadow: pulse ? "0 0 0 6px rgba(255,90,31,0.3)" : "none",
        transition: "box-shadow 0.6s ease",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: CLUB_COLORS[player.club] || "#555",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'DM Mono', monospace", fontSize: 8, color: "white", fontWeight: 600,
        }}>{player.club[0]}</div>

        {/* Points badge */}
        <div style={{
          position: "absolute", top: -8, right: -8,
          background: isOpponent ? "#2A2520" : player.hero ? "#FF5A1F" : isHighScore ? "#16A34A" : "#1C1410",
          border: `1px solid ${player.hero ? "#FF5A1F" : isHighScore ? "#16A34A" : "rgba(255,255,255,0.15)"}`,
          borderRadius: 6, padding: "1px 5px",
          fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600,
          color: "white", lineHeight: 1.4,
        }}>{player.pts}</div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 500,
          color: player.hero ? "#FF5A1F" : isOpponent ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.75)",
          whiteSpace: "nowrap", maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis",
        }}>{player.short || player.name}</div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("pitch"); // pitch | breakdown
  const [fixtureIdx, setFixtureIdx] = useState(0);
  const [feedFilter, setFeedFilter] = useState("all"); // all | mine

  const myTotal = MY_PLAYERS.reduce((s, p) => s + p.pts, 0);
  const oppTotal = OPP_PLAYERS.reduce((s, p) => s + p.pts, 0);
  const winning = myTotal > oppTotal;
  const diff = Math.abs(myTotal - oppTotal);

  const displayFeed = feedFilter === "mine"
    ? LIVE_FEED.filter(e => e.mine)
    : LIVE_FEED;

  return (
    <div style={{ minHeight: "100vh", background: "#0F0D0B", color: "#F5F0E8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scoreUp { 0%{transform:translateY(0);opacity:1} 50%{transform:translateY(-12px);opacity:1} 100%{transform:translateY(0);opacity:1} }

        .live-dot { animation: pulse 1.5s ease infinite; }
        .feed-item { animation: slideDown 0.3s ease; }

        .tab-btn {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 7px 16px; border-radius: 8px; border: none;
          cursor: pointer; transition: all 0.15s;
          background: transparent; color: rgba(255,255,255,0.3);
        }
        .tab-btn:hover { color: rgba(255,255,255,0.7); }
        .tab-btn.active { background: rgba(255,90,31,0.15); color: #FF5A1F; }

        .fixture-chip {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 10px; border-radius: 8px; flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.04);
          cursor: pointer; transition: all 0.15s;
        }
        .fixture-chip:hover { border-color: rgba(255,90,31,0.3); background: rgba(255,90,31,0.06); }
        .fixture-chip.live { border-color: rgba(255,90,31,0.25); }

        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: #2A2018; border-radius: 2px; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        height: 56, background: "#0A0806",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 24px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg,#FF5A1F,#E8400A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(255,90,31,0.4)", fontSize: 13,
          }}>◆</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em" }}>CURTIS</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF5A1F" }} />
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#FF5A1F", letterSpacing: "0.1em" }}>GAMEWEEK 28 · LIVE</span>
        </div>

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
          The Gaffer's Cup
        </div>
      </nav>

      {/* ── FIXTURE STRIP ── */}
      <div style={{
        background: "#0A0806", borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "8px 20px", display: "flex", gap: 6, overflowX: "auto",
      }}>
        {FIXTURES.map((f, i) => (
          <div key={i} className={`fixture-chip${f.status === "live" ? " live" : ""}`}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{f.home}</span>
            {f.status === "upcoming" ? (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", padding: "0 3px" }}>{f.kickoff}</span>
            ) : (
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: f.status === "live" ? "#FF5A1F" : "rgba(255,255,255,0.6)", padding: "0 2px" }}>
                {f.hs}–{f.as}
              </span>
            )}
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{f.away}</span>
            {f.status === "live" && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#FF5A1F", marginLeft: 2 }}>{f.min}'</span>
            )}
          </div>
        ))}
      </div>

      {/* ── SCOREBOARD ── */}
      <div style={{
        background: "linear-gradient(180deg, #1A1208 0%, #0F0D0B 100%)",
        padding: "24px 24px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 600, margin: "0 auto" }}>

          {/* My team */}
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
              You
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#F5F0E8", marginBottom: 2 }}>Interception FC</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 52, fontWeight: 900, color: winning ? "#FF5A1F" : "#F5F0E8", lineHeight: 1 }}>
              {myTotal}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4, letterSpacing: "0.06em" }}>pts</div>
          </div>

          {/* VS / status */}
          <div style={{ textAlign: "center", padding: "0 20px" }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.2)", marginBottom: 8,
            }}>vs</div>
            <div style={{
              padding: "6px 14px", borderRadius: 8,
              background: winning ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)",
              border: `1px solid ${winning ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"}`,
            }}>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 10,
                color: winning ? "#4ADE80" : "#F87171",
                letterSpacing: "0.08em", textTransform: "uppercase",
              }}>
                {winning ? `+${diff} up` : `-${diff} down`}
              </div>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", marginTop: 8, letterSpacing: "0.06em" }}>GW28</div>
          </div>

          {/* Opponent */}
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
              Opponent
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#F5F0E8", marginBottom: 2 }}>Big Phil's XI</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 52, fontWeight: 900, color: !winning ? "#FF5A1F" : "rgba(255,255,255,0.5)", lineHeight: 1 }}>
              {oppTotal}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4, letterSpacing: "0.06em" }}>pts</div>
          </div>
        </div>

        {/* Curtis hero moment banner */}
        <div style={{
          maxWidth: 600, margin: "16px auto 0",
          padding: "10px 16px", borderRadius: 10,
          background: "rgba(255,90,31,0.1)",
          border: "1px solid rgba(255,90,31,0.25)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>🛡</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#FF5A1F", fontWeight: 600 }}>Curtis Moment · </span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              Davies C (17 pts) is your top scorer — more than Salah right now
            </span>
          </div>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#FF5A1F" }}>◆</span>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", height: "calc(100vh - 260px)", overflow: "hidden" }}>

        {/* LEFT — Pitch / Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 4, padding: "10px 16px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.02)",
          }}>
            <button className={`tab-btn${activeTab === "pitch" ? " active" : ""}`} onClick={() => setActiveTab("pitch")}>Pitch View</button>
            <button className={`tab-btn${activeTab === "breakdown" ? " active" : ""}`} onClick={() => setActiveTab("breakdown")}>Breakdown</button>
          </div>

          {activeTab === "pitch" && (
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>

              {/* My pitch half */}
              <div style={{
                borderRight: "1px solid rgba(255,255,255,0.06)",
                background: "radial-gradient(ellipse at center bottom, rgba(34,85,34,0.18) 0%, transparent 70%)",
                position: "relative", overflow: "hidden",
              }}>
                {/* Pitch lines */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06 }}>
                  <div style={{ position: "absolute", left: "10%", right: "10%", top: "10%", bottom: "10%", border: "1px solid white", borderRadius: 2 }} />
                  <div style={{ position: "absolute", left: "25%", right: "25%", top: "10%", height: "22%", border: "1px solid white", borderTop: "none" }} />
                  <div style={{ position: "absolute", left: "50%", top: "10%", bottom: "10%", width: 1, background: "white" }} />
                </div>

                <div style={{ padding: "8px 6px 4px", textAlign: "center" }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#FF5A1F", textTransform: "uppercase" }}>
                    Interception FC · {myTotal} pts
                  </span>
                </div>
                <PitchView players={MY_PLAYERS} />
              </div>

              {/* Opponent pitch half */}
              <div style={{
                background: "radial-gradient(ellipse at center top, rgba(34,85,34,0.12) 0%, transparent 70%)",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06 }}>
                  <div style={{ position: "absolute", left: "10%", right: "10%", top: "10%", bottom: "10%", border: "1px solid white", borderRadius: 2 }} />
                  <div style={{ position: "absolute", left: "25%", right: "25%", bottom: "10%", height: "22%", border: "1px solid white", borderBottom: "none" }} />
                </div>

                <div style={{ padding: "8px 6px 4px", textAlign: "center" }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                    Big Phil's XI · {oppTotal} pts
                  </span>
                </div>
                <PitchView players={OPP_PLAYERS} isOpponent />
              </div>
            </div>
          )}

          {activeTab === "breakdown" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {/* My players sorted by pts */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FF5A1F", marginBottom: 10 }}>
                  Your Players
                </div>
                {[...MY_PLAYERS].sort((a,b) => b.pts - a.pts).map((p, i) => (
                  <div key={p.id} style={{
                    display: "grid", gridTemplateColumns: "20px 1fr auto",
                    gap: 10, padding: "10px 12px", borderRadius: 9,
                    background: p.hero ? "rgba(255,90,31,0.07)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${p.hero ? "rgba(255,90,31,0.2)" : "rgba(255,255,255,0.04)"}`,
                    marginBottom: 4, alignItems: "center",
                  }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>#{i+1}</span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#F5F0E8" }}>{p.name}</span>
                        <span style={{
                          fontSize: 9, padding: "2px 5px", borderRadius: 4,
                          background: POS_META[p.pos].bg, color: POS_META[p.pos].color,
                          fontFamily: "'DM Mono', monospace",
                        }}>{p.pos}</span>
                        {p.hero && <span style={{ fontSize: 9, background: "rgba(255,90,31,0.15)", color: "#FF5A1F", fontFamily: "'DM Mono', monospace", padding: "2px 6px", borderRadius: 4 }}>HERO</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {p.events.map((e, ei) => (
                          <span key={ei} style={{
                            fontFamily: "'DM Mono', monospace", fontSize: 9,
                            color: e.pts > 0 ? "rgba(74,222,128,0.7)" : "rgba(248,113,113,0.7)",
                            letterSpacing: "0.04em",
                          }}>{e.icon} {e.text} ({e.pts > 0 ? "+" : ""}{e.pts})</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: p.hero ? "#FF5A1F" : "#F5F0E8" }}>{p.pts}</div>
                  </div>
                ))}
              </div>

              {/* Opponent */}
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                  Big Phil's XI
                </div>
                {[...OPP_PLAYERS].sort((a,b) => b.pts - a.pts).map((p, i) => (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: 8,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    marginBottom: 3,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>#{i+1}</span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{p.name}</span>
                      <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: POS_META[p.pos].bg, color: POS_META[p.pos].color, fontFamily: "'DM Mono', monospace" }}>{p.pos}</span>
                    </div>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>{p.pts}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Live Feed */}
        <div style={{
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          background: "#0A0806",
        }}>
          {/* Feed header */}
          <div style={{
            padding: "12px 14px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF5A1F" }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Live Feed</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", padding: 3, borderRadius: 8 }}>
              {[{id:"all",label:"All"},{id:"mine",label:"My Team"}].map(f => (
                <button key={f.id} onClick={() => setFeedFilter(f.id)} style={{
                  flex: 1, padding: "5px", borderRadius: 6, border: "none",
                  background: feedFilter === f.id ? "rgba(255,90,31,0.15)" : "transparent",
                  fontFamily: "'DM Mono', monospace", fontSize: 9,
                  letterSpacing: "0.07em", textTransform: "uppercase",
                  color: feedFilter === f.id ? "#FF5A1F" : "rgba(255,255,255,0.25)",
                  cursor: "pointer", transition: "all 0.15s",
                }}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* Feed items */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
            {displayFeed.map((item, i) => (
              <div key={i} className="feed-item" style={{
                display: "flex", gap: 10, padding: "9px 10px", borderRadius: 8,
                background: item.hero ? "rgba(255,90,31,0.08)" : item.mine ? "rgba(255,255,255,0.03)" : "transparent",
                border: `1px solid ${item.hero ? "rgba(255,90,31,0.2)" : "transparent"}`,
                marginBottom: 3,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: item.mine ? "rgba(255,90,31,0.1)" : "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14,
                }}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                    <span style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: item.mine ? 600 : 400,
                      color: item.mine ? "#F5F0E8" : "rgba(255,255,255,0.35)",
                    }}>{item.player}</span>
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600,
                      color: item.pts.startsWith("+") ? "#4ADE80" : "#F87171", flexShrink: 0,
                    }}>{item.pts}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>{item.event}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Points summary footer */}
          <div style={{
            padding: "12px 14px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}>
            {[
              { label: "My total",    value: myTotal,  color: "#FF5A1F"  },
              { label: "Opp total",   value: oppTotal, color: "rgba(255,255,255,0.3)" },
              { label: "My best",     value: `Davies C · 17`, color: "#FF5A1F" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: s.color, fontWeight: 500 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
