import { useState } from "react";

const LEAGUES = [
  {
    id: 1,
    name: "The Gaffer's Cup",
    season: "2025/26",
    gameweek: 28,
    totalGW: 38,
    rank: 3,
    teams: 10,
    myTeam: "Interception FC",
    myPoints: 1842,
    leaderPoints: 2104,
    leaderName: "Big Phil's XI",
    gwPoints: 74,
    gwRank: 2,
    status: "live",
    nextFixture: { home: "Arsenal", away: "Chelsea", kickoff: "Sat 12:30" },
    form: ["W","W","L","W","D"],
  },
  {
    id: 2,
    name: "Office Banter League",
    season: "2025/26",
    gameweek: 28,
    totalGW: 38,
    rank: 1,
    teams: 8,
    myTeam: "Davies's Army",
    myPoints: 2201,
    leaderPoints: 2201,
    leaderName: "Davies's Army",
    gwPoints: 91,
    gwRank: 1,
    status: "live",
    nextFixture: { home: "Man City", away: "Liverpool", kickoff: "Sat 17:30" },
    form: ["W","W","W","D","W"],
  },
  {
    id: 3,
    name: "Sunday League Legends",
    season: "2025/26",
    gameweek: 28,
    totalGW: 38,
    rank: 7,
    teams: 12,
    myTeam: "Tiki-Taka FC",
    myPoints: 1654,
    leaderPoints: 2310,
    leaderName: "Mourinho's Parking Lot",
    gwPoints: 58,
    gwRank: 9,
    status: "complete",
    nextFixture: { home: "Spurs", away: "Newcastle", kickoff: "Sun 14:00" },
    form: ["L","D","L","W","L"],
  },
];

const MY_PLAYERS = [
  { name: "Pickford", pos: "GK",  club: "EVE", gwPts: 9,  season: 112 },
  { name: "Alexander-Arnold", pos: "DEF", club: "LIV", gwPts: 14, season: 198 },
  { name: "Davies C", pos: "DEF", club: "BOU", gwPts: 17, season: 221, hero: true },
  { name: "Mykolenko", pos: "DEF", club: "EVE", gwPts: 6,  season: 98  },
  { name: "Salah", pos: "MID", club: "LIV", gwPts: 22, season: 287 },
  { name: "Palmer", pos: "MID", club: "CHE", gwPts: 11, season: 201 },
  { name: "Mbeumo", pos: "MID", club: "BRE", gwPts: 8,  season: 176 },
  { name: "Watkins", pos: "FWD", club: "AVL", gwPts: 6,  season: 154 },
  { name: "Haaland", pos: "FWD", club: "MCI", gwPts: 7,  season: 188 },
];

const ACTIVITY = [
  { type: "goal",         text: "Salah scores — +6 pts",              time: "2m ago",  pts: "+6"  },
  { type: "interception", text: "Davies C: 3rd interception — +1.5 pts", time: "14m ago", pts: "+1.5", hero: true },
  { type: "cleansheet",   text: "Pickford clean sheet at HT — +5 pts", time: "47m ago", pts: "+5"  },
  { type: "yellowcard",   text: "Mykolenko yellow card — -2 pts",      time: "1h ago",  pts: "-2"  },
  { type: "assist",       text: "Alexander-Arnold assist — +3.5 pts",  time: "2h ago",  pts: "+3.5"},
];

const FORM_COLOR = { W: "#16A34A", D: "#D97706", L: "#DC2626" };

const POS_COLOR = {
  GK:  { bg: "#FEF9C3", color: "#92400E" },
  DEF: { bg: "#DBEAFE", color: "#1E40AF" },
  MID: { bg: "#F3E8FF", color: "#6B21A8" },
  FWD: { bg: "#FFF1EC", color: "#C2410C" },
};

export default function App() {
  const [activeLeague, setActiveLeague] = useState(LEAGUES[0]);
  const [tab, setTab] = useState("overview");

  const pct = (activeLeague.gameweek / activeLeague.totalGW) * 100;
  const gap = activeLeague.leaderPoints - activeLeague.myPoints;

  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", color: "#1C1410" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .league-card {
          border-radius: 14px;
          border: 1.5px solid #EDE5D8;
          padding: 18px 20px;
          cursor: pointer;
          transition: all 0.18s;
          background: white;
        }
        .league-card:hover { border-color: #FF5A1F; box-shadow: 0 4px 20px rgba(255,90,31,0.1); transform: translateY(-1px); }
        .league-card.active { border-color: #FF5A1F; box-shadow: 0 4px 24px rgba(255,90,31,0.15); }

        .tab-btn {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          padding: 8px 18px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
          background: transparent;
          color: #A89880;
        }
        .tab-btn:hover { color: #1C1410; background: #F0E8DC; }
        .tab-btn.active { background: #FF5A1F; color: white; }

        .player-row {
          display: grid;
          grid-template-columns: 28px 1fr 44px 52px 56px;
          align-items: center;
          gap: 10px;
          padding: 9px 16px;
          border-radius: 9px;
          transition: background 0.14s;
        }
        .player-row:hover { background: #FFF7F3; }

        .activity-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 16px;
          border-radius: 10px;
          transition: background 0.14s;
        }
        .activity-item:hover { background: #FFF7F3; }

        .stat-box {
          background: white;
          border-radius: 14px;
          border: 1.5px solid #EDE5D8;
          padding: 20px 22px;
          flex: 1;
        }

        .new-btn {
          background: linear-gradient(135deg, #FF5A1F, #E8400A);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 11px 22px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 3px 12px rgba(255,90,31,0.3);
          transition: all 0.18s;
        }
        .new-btn:hover { transform: translateY(-1px); box-shadow: 0 5px 18px rgba(255,90,31,0.4); }

        .nav-link {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #A89880;
          cursor: pointer;
          padding: 6px 0;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }
        .nav-link:hover { color: #FF5A1F; }
        .nav-link.active { color: #FF5A1F; border-bottom-color: #FF5A1F; }

        .progress-track {
          height: 5px;
          background: #F0E8DC;
          border-radius: 99px;
          overflow: hidden;
          margin-top: 8px;
        }
        .progress-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #FF5A1F, #E8400A);
          transition: width 0.6s ease;
        }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #E8D5C0; border-radius: 2px; }
      `}</style>

      {/* NAV */}
      <nav style={{
        height: 58, background: "#FAF7F2", borderBottom: "1px solid #EDE5D8",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 44px", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 34, height: 34,
            background: "linear-gradient(135deg, #FF5A1F 0%, #E8400A 100%)",
            borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 3px 10px rgba(255,90,31,0.35)",
          }}>
            <span style={{ color: "white", fontSize: 16 }}>◆</span>
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>CURTIS</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.14em", color: "#FF5A1F", textTransform: "uppercase" }}>Draft Football</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {["Home","Draft","Scoring","Live","Stats"].map(item => (
            <span key={item} className={`nav-link${item === "Home" ? " active" : ""}`}>{item}</span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", letterSpacing: "0.06em" }}>GW28 · Live</div>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: "#16A34A",
            boxShadow: "0 0 0 3px rgba(22,163,74,0.2)",
            animation: "pulse 2s infinite",
          }} />
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #FF5A1F, #E8400A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'DM Mono', monospace", fontSize: 12, color: "white",
          }}>JD</div>
        </div>
      </nav>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "40px 40px" }}>

        {/* Welcome */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF5A1F", marginBottom: 6 }}>
              Gameweek 28 · Saturday
            </p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Good morning,<br />
              <span style={{ fontStyle: "italic", color: "#FF5A1F" }}>Gaffer.</span>
            </h1>
          </div>
          <button className="new-btn">+ New League</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>

          {/* LEFT — league list */}
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A89880", marginBottom: 12 }}>
              Your Leagues ({LEAGUES.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {LEAGUES.map(l => (
                <div
                  key={l.id}
                  className={`league-card${activeLeague.id === l.id ? " active" : ""}`}
                  onClick={() => setActiveLeague(l)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1C1410", marginBottom: 2 }}>{l.name}</p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", letterSpacing: "0.06em" }}>{l.myTeam}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 22, fontWeight: 900,
                        color: l.rank === 1 ? "#FF5A1F" : "#1C1410",
                      }}>
                        {l.rank === 1 ? "🥇" : `#${l.rank}`}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#A89880", letterSpacing: "0.06em" }}>of {l.teams}</div>
                    </div>
                  </div>

                  {/* Form dots */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                    {l.form.map((f, i) => (
                      <div key={i} style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: FORM_COLOR[f],
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'DM Mono', monospace", fontSize: 9,
                        color: "white", fontWeight: 500,
                      }}>{f}</div>
                    ))}
                  </div>

                  {/* GW progress */}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#C0B09A", letterSpacing: "0.06em" }}>GW{l.gameweek}/{l.totalGW}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: l.status === "live" ? "#FF5A1F" : "#A89880", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {l.status === "live" ? "● Live" : "Complete"}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${(l.gameweek / l.totalGW) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — league detail */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* League name + tabs */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, letterSpacing: "-0.01em" }}>{activeLeague.name}</h2>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", letterSpacing: "0.08em", marginTop: 2 }}>{activeLeague.myTeam} · Season {activeLeague.season}</p>
              </div>
              <div style={{ display: "flex", gap: 4, background: "#F5EFE8", padding: 4, borderRadius: 10 }}>
                {["overview","squad","activity"].map(t => (
                  <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
                ))}
              </div>
            </div>

            {/* Stat boxes */}
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { label: "Season Pts", value: activeLeague.myPoints.toLocaleString(), sub: `${gap > 0 ? `-${gap}` : "Leading"} pts to top` },
                { label: "GW28 Pts", value: activeLeague.gwPoints, sub: `Rank #${activeLeague.gwRank} this week` },
                { label: "Position", value: `#${activeLeague.rank}`, sub: `of ${activeLeague.teams} teams` },
                { label: "Next Kick-off", value: activeLeague.nextFixture.kickoff, sub: `${activeLeague.nextFixture.home} v ${activeLeague.nextFixture.away}` },
              ].map(s => (
                <div key={s.label} className="stat-box">
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C0B09A", marginBottom: 6 }}>{s.label}</p>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#1C1410", lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#A89880", marginTop: 4, letterSpacing: "0.04em" }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Leader banner */}
            <div style={{
              background: "linear-gradient(135deg, #1C1410 0%, #3D2E22 100%)",
              borderRadius: 14, padding: "16px 22px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>League Leader</p>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "white", fontStyle: "italic" }}>{activeLeague.leaderName}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Points</p>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#FF5A1F" }}>{activeLeague.leaderPoints.toLocaleString()}</p>
              </div>
            </div>

            {/* Tab content */}
            {tab === "overview" && (
              <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #EDE5D8", overflow: "hidden" }}>
                <div style={{ padding: "18px 20px 10px", borderBottom: "1px solid #F5EFE8" }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A89880" }}>Top Performers · GW28</p>
                </div>
                {MY_PLAYERS.sort((a,b) => b.gwPts - a.gwPts).slice(0,5).map((p, i) => (
                  <div key={p.name} className="player-row" style={{ borderBottom: i < 4 ? "1px solid #FAF5F0" : "none" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#C0B09A" }}>#{i+1}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#1C1410" }}>{p.name}</span>
                      {p.hero && <span style={{ fontSize: 9, background: "#FFF1EC", color: "#FF5A1F", fontFamily: "'DM Mono', monospace", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.06em" }}>HERO</span>}
                    </div>
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 9,
                      padding: "3px 6px", borderRadius: 5,
                      background: POS_COLOR[p.pos].bg,
                      color: POS_COLOR[p.pos].color,
                      textAlign: "center",
                    }}>{p.pos}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", textAlign: "center" }}>{p.club}</span>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "#FF5A1F", textAlign: "right" }}>{p.gwPts}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "squad" && (
              <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #EDE5D8", overflow: "hidden" }}>
                <div style={{ padding: "18px 20px 10px", borderBottom: "1px solid #F5EFE8", display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A89880" }}>Full Squad</p>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880" }}>GW Pts · Season</p>
                </div>
                {MY_PLAYERS.map((p, i) => (
                  <div key={p.name} className="player-row" style={{ borderBottom: i < MY_PLAYERS.length - 1 ? "1px solid #FAF5F0" : "none" }}>
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 9,
                      padding: "3px 6px", borderRadius: 5, textAlign: "center",
                      background: POS_COLOR[p.pos].bg, color: POS_COLOR[p.pos].color,
                    }}>{p.pos}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                      {p.hero && <span style={{ fontSize: 9, background: "#FFF1EC", color: "#FF5A1F", fontFamily: "'DM Mono', monospace", padding: "2px 6px", borderRadius: 4 }}>HERO</span>}
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880", textAlign: "center" }}>{p.club}</span>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#FF5A1F", textAlign: "right" }}>{p.gwPts}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#A89880", textAlign: "right" }}>{p.season}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "activity" && (
              <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #EDE5D8", overflow: "hidden" }}>
                <div style={{ padding: "18px 20px 10px", borderBottom: "1px solid #F5EFE8" }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A89880" }}>Live Activity Feed</p>
                </div>
                {ACTIVITY.map((a, i) => (
                  <div key={i} className="activity-item" style={{ borderBottom: i < ACTIVITY.length - 1 ? "1px solid #FAF5F0" : "none" }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: a.hero ? "#FFF1EC" : a.pts.startsWith("-") ? "#FEF2F2" : "#F0FDF4",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                    }}>
                      {a.type === "goal" ? "⚽" : a.type === "interception" ? "🛡️" : a.type === "cleansheet" ? "🧤" : a.type === "yellowcard" ? "🟨" : "🎯"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: a.hero ? 600 : 400, color: "#1C1410" }}>{a.text}</p>
                      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#C0B09A", marginTop: 2, letterSpacing: "0.06em" }}>{a.time}</p>
                    </div>
                    <span style={{
                      fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700,
                      color: a.pts.startsWith("-") ? "#DC2626" : "#16A34A",
                    }}>{a.pts}</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
