import { useState } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const TEAMS = [
  {
    rank: 1, prev: 2, id: 1,
    name: "Davies's Army",       manager: "Tom H",
    played: 27, won: 18, drawn: 4, lost: 5,
    pts: 2201, gw: 91, ptsFor: 2201, ptsAgainst: 1834,
    form: ["W","W","W","D","W"],
    hero: "Davies C · 221 pts",
    you: false,
  },
  {
    rank: 2, prev: 1, id: 2,
    name: "Big Phil's XI",        manager: "Phil D",
    played: 27, won: 17, drawn: 3, lost: 7,
    pts: 2104, gw: 83, ptsFor: 2104, ptsAgainst: 1891,
    form: ["W","L","W","W","D"],
    hero: "Saka · 218 pts",
    you: false,
  },
  {
    rank: 3, prev: 4, id: 3,
    name: "Interception FC",      manager: "You",
    played: 27, won: 16, drawn: 5, lost: 6,
    pts: 1842, gw: 74, ptsFor: 1842, ptsAgainst: 1755,
    form: ["W","W","L","W","D"],
    hero: "Salah · 287 pts",
    you: true,
  },
  {
    rank: 4, prev: 3, id: 4,
    name: "Tiki-Taka United",     manager: "Sara M",
    played: 27, won: 15, drawn: 4, lost: 8,
    pts: 1798, gw: 66, ptsFor: 1798, ptsAgainst: 1812,
    form: ["L","W","W","L","W"],
    hero: "Palmer · 201 pts",
    you: false,
  },
  {
    rank: 5, prev: 5, id: 5,
    name: "Parking the Bus FC",   manager: "Raj P",
    played: 27, won: 14, drawn: 6, lost: 7,
    pts: 1743, gw: 79, ptsFor: 1743, ptsAgainst: 1688,
    form: ["D","W","D","W","W"],
    hero: "Gvardiol · 172 pts",
    you: false,
  },
  {
    rank: 6, prev: 7, id: 6,
    name: "High Press Heroes",    manager: "Luke T",
    played: 27, won: 13, drawn: 5, lost: 9,
    pts: 1701, gw: 88, ptsFor: 1701, ptsAgainst: 1743,
    form: ["W","W","L","W","W"],
    hero: "Haaland · 241 pts",
    you: false,
  },
  {
    rank: 7, prev: 6, id: 7,
    name: "Counter Attack XI",    manager: "Abi W",
    played: 27, won: 11, drawn: 7, lost: 9,
    pts: 1654, gw: 55, ptsFor: 1654, ptsAgainst: 1698,
    form: ["D","L","W","D","L"],
    hero: "Watkins · 198 pts",
    you: false,
  },
  {
    rank: 8, prev: 9, id: 8,
    name: "Mourinho's Lot",       manager: "Chris B",
    played: 27, won: 10, drawn: 6, lost: 11,
    pts: 1612, gw: 61, ptsFor: 1612, ptsAgainst: 1754,
    form: ["L","W","D","L","W"],
    hero: "Trippier · 161 pts",
    you: false,
  },
  {
    rank: 9, prev: 8, id: 9,
    name: "Sunday League Legends",manager: "Mo F",
    played: 27, won: 9, drawn: 5, lost: 13,
    pts: 1544, gw: 58, ptsFor: 1544, ptsAgainst: 1822,
    form: ["L","D","L","W","L"],
    hero: "Isak · 187 pts",
    you: false,
  },
  {
    rank: 10, prev: 10, id: 10,
    name: "Route One Rovers",     manager: "Dan K",
    played: 27, won: 6, drawn: 4, lost: 17,
    pts: 1401, gw: 42, ptsFor: 1401, ptsAgainst: 1987,
    form: ["L","L","L","D","L"],
    hero: "Fernandes · 187 pts",
    you: false,
  },
];

const GW_HISTORY = [
  { gw: 24, scores: [78, 91, 65, 72, 55, 88, 61, 74, 49, 38] },
  { gw: 25, scores: [95, 67, 81, 58, 90, 72, 44, 55, 62, 51] },
  { gw: 26, scores: [71, 88, 92, 64, 78, 55, 68, 43, 57, 39] },
  { gw: 27, scores: [83, 74, 88, 77, 65, 91, 52, 60, 48, 44] },
  { gw: 28, scores: [91, 83, 74, 66, 79, 88, 55, 61, 58, 42] },
];

const H2H = {
  // [myId][oppId] = { w, d, l }
  3: {
    1: { w:1, d:1, l:0 }, 2: { w:1, d:0, l:1 }, 4: { w:2, d:0, l:0 },
    5: { w:1, d:1, l:0 }, 6: { w:0, d:1, l:1 }, 7: { w:2, d:0, l:0 },
    8: { w:1, d:1, l:1 }, 9: { w:2, d:0, l:0 }, 10:{ w:2, d:0, l:0 },
  }
};

const FORM_COLOR = { W:"#16A34A", D:"#D97706", L:"#DC2626" };
const FORM_BG    = { W:"rgba(22,163,74,0.15)", D:"rgba(217,119,6,0.15)", L:"rgba(220,38,38,0.12)" };

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function FormPips({ form }) {
  return (
    <div style={{ display:"flex", gap:3 }}>
      {form.map((f,i) => (
        <div key={i} style={{
          width: 20, height: 20, borderRadius: 5,
          background: FORM_BG[f],
          border: `1px solid ${FORM_COLOR[f]}44`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'DM Mono', monospace", fontSize:9,
          color: FORM_COLOR[f], fontWeight:500,
        }}>{f}</div>
      ))}
    </div>
  );
}

function RankChange({ curr, prev }) {
  const diff = prev - curr;
  if (diff === 0) return <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:"rgba(28,20,16,0.2)" }}>—</span>;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      <span style={{ fontSize:8, color: diff > 0 ? "#16A34A" : "#DC2626" }}>{diff > 0 ? "▲" : "▼"}</span>
      <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color: diff > 0 ? "#16A34A" : "#DC2626" }}>{Math.abs(diff)}</span>
    </div>
  );
}

function MiniSparkline({ teamIdx }) {
  const scores = GW_HISTORY.map(gw => gw.scores[teamIdx]);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const w = 60, h = 24;
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((s - min) / (max - min + 1)) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} style={{ overflow:"visible" }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="#FF5A1F"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {scores.map((s, i) => {
        const x = (i / (scores.length - 1)) * w;
        const y = h - ((s - min) / (max - min + 1)) * h;
        return <circle key={i} cx={x} cy={y} r="2" fill="#FF5A1F" opacity="0.8" />;
      })}
    </svg>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState("table"); // table | h2h | form
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [sortBy, setSortBy] = useState("pts");

  const myTeam = TEAMS.find(t => t.you);

  const sorted = [...TEAMS].sort((a, b) => {
    if (sortBy === "pts")  return b.pts - a.pts;
    if (sortBy === "gw")   return b.gw - a.gw;
    if (sortBy === "won")  return b.won - a.won;
    return b.pts - a.pts;
  });

  const maxPts = TEAMS[0].pts;

  return (
    <div style={{ minHeight:"100vh", background:"#FAF7F2", color:"#1C1410" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }

        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .row-appear { animation: fadeUp 0.3s ease both; }

        .table-row {
          display: grid;
          grid-template-columns: 28px 20px 1fr 44px 44px 44px 44px 80px 100px 72px;
          gap: 0;
          align-items: center;
          padding: 0 20px;
          height: 54px;
          border-bottom: 1px solid #F5EFE8;
          cursor: pointer;
          transition: background 0.14s;
        }
        .table-row:hover { background: #FFF7F4; }
        .table-row.you {
          background: #FFF1EC;
          border-left: 3px solid #FF5A1F;
        }
        .table-row.you:hover { background: #FFE8DC; }

        .col-header {
          font-family: 'DM Mono', monospace;
          font-size: 9px; letter-spacing: 0.12em;
          text-transform: uppercase; color: #C0B09A;
          cursor: pointer; transition: color 0.15s;
          user-select: none;
        }
        .col-header:hover { color: #FF5A1F; }
        .col-header.active { color: #FF5A1F; }

        .view-btn {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 8px 18px; border-radius: 8px; border: none;
          cursor: pointer; transition: all 0.15s;
          background: transparent; color: #A89880;
        }
        .view-btn:hover { color: #1C1410; background: #F0E8DC; }
        .view-btn.active { background: #FF5A1F; color: white; }

        .h2h-cell {
          width: 28px; height: 28px; border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500;
        }

        .stat-card {
          background: white; border-radius: 14px;
          border: 1.5px solid #EDE5D8; padding: 18px 20px;
          flex: 1;
        }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #E8D5C0; border-radius: 2px; }
      `}</style>

      {/* NAV */}
      <nav style={{
        height:58, background:"#FAF7F2", borderBottom:"1px solid #EDE5D8",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 44px", position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:11 }}>
          <div style={{
            width:34, height:34, background:"linear-gradient(135deg,#FF5A1F,#E8400A)",
            borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 3px 10px rgba(255,90,31,0.35)",
          }}><span style={{ color:"white", fontSize:16 }}>◆</span></div>
          <div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, fontWeight:900, letterSpacing:"-0.02em", lineHeight:1 }}>CURTIS</div>
            <div style={{ fontFamily:"'DM Mono', monospace", fontSize:8, letterSpacing:"0.14em", color:"#FF5A1F", textTransform:"uppercase" }}>Draft Football</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:28 }}>
          {["Home","Draft","Scoring","Live","League"].map(item => (
            <span key={item} style={{
              fontFamily:"'DM Mono', monospace", fontSize:11, letterSpacing:"0.09em",
              textTransform:"uppercase", color: item==="League" ? "#FF5A1F" : "#A89880",
              cursor:"pointer", paddingBottom:4,
              borderBottom: item==="League" ? "2px solid #FF5A1F" : "2px solid transparent",
            }}>{item}</span>
          ))}
        </div>
        <div style={{
          width:32, height:32, borderRadius:"50%",
          background:"linear-gradient(135deg,#FF5A1F,#E8400A)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'DM Mono', monospace", fontSize:12, color:"white",
        }}>JD</div>
      </nav>

      <div style={{ maxWidth:1060, margin:"0 auto", padding:"40px 40px" }}>

        {/* Page header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:32 }}>
          <div>
            <p style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", color:"#FF5A1F", marginBottom:6 }}>
              The Gaffer's Cup · Season 2025/26
            </p>
            <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:38, fontWeight:900, letterSpacing:"-0.02em", lineHeight:1.05 }}>
              League <span style={{ fontStyle:"italic", color:"#FF5A1F" }}>Table</span>
            </h1>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"#A89880", letterSpacing:"0.06em", marginBottom:2 }}>Gameweek</p>
            <p style={{ fontFamily:"'Playfair Display', serif", fontSize:32, fontWeight:900, color:"#1C1410", lineHeight:1 }}>28 <span style={{ fontSize:14, color:"#A89880", fontFamily:"'DM Mono', monospace" }}>/ 38</span></p>
          </div>
        </div>

        {/* Your position callout */}
        <div style={{
          background:"linear-gradient(135deg,#1C1410 0%,#3D2E22 100%)",
          borderRadius:16, padding:"20px 28px", marginBottom:28,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          boxShadow:"0 8px 32px rgba(28,20,16,0.2)",
        }}>
          <div>
            <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(255,255,255,0.35)", marginBottom:5 }}>Your Position</p>
            <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
              <span style={{ fontFamily:"'Playfair Display', serif", fontSize:48, fontWeight:900, color:"#FF5A1F", lineHeight:1 }}>3rd</span>
              <span style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"rgba(255,255,255,0.4)" }}>of 10 teams</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:20 }}>
            {[
              { label:"Points",      value: myTeam.pts.toLocaleString() },
              { label:"GW28",        value: myTeam.gw },
              { label:"Gap to 1st",  value: `-${(TEAMS[0].pts - myTeam.pts)}` },
              { label:"Gap to 4th",  value: `+${(myTeam.pts - TEAMS[3].pts)}` },
            ].map(s => (
              <div key={s.label} style={{ textAlign:"center" }}>
                <p style={{ fontFamily:"'DM Mono', monospace", fontSize:8, letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:4 }}>{s.label}</p>
                <p style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:900, color:"white", lineHeight:1 }}>{s.value}</p>
              </div>
            ))}
          </div>
          <FormPips form={myTeam.form} />
        </div>

        {/* Stat summary strip */}
        <div style={{ display:"flex", gap:12, marginBottom:28 }}>
          {[
            { label:"Top scorer GW28", value:"High Press Heroes", sub:"88 pts this week", icon:"⚡" },
            { label:"Form team",       value:"Davies's Army",     sub:"4W 1D last 5",    icon:"🔥" },
            { label:"Season leader",   value:"Haaland",           sub:"241 pts total",   icon:"⚽" },
            { label:"Curtis Hero",     value:"Davies C",          sub:"221 pts · DEF",   icon:"🛡" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                <span style={{ fontSize:14 }}>{s.icon}</span>
                <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#C0B09A" }}>{s.label}</p>
              </div>
              <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:600, color:"#1C1410", marginBottom:2 }}>{s.value}</p>
              <p style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"#A89880", letterSpacing:"0.04em" }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* View toggle */}
        <div style={{ display:"flex", gap:4, background:"#F5EFE8", padding:4, borderRadius:10, marginBottom:0, width:"fit-content" }}>
          {[{id:"table",label:"Standings"},{id:"form",label:"Form Guide"},{id:"h2h",label:"Head-to-Head"}].map(v => (
            <button key={v.id} className={`view-btn${view===v.id?" active":""}`} onClick={() => setView(v.id)}>{v.label}</button>
          ))}
        </div>

        {/* ── TABLE VIEW ── */}
        {view === "table" && (
          <div style={{ background:"white", borderRadius:"0 16px 16px 16px", border:"1.5px solid #EDE5D8", overflow:"hidden", boxShadow:"0 4px 24px rgba(28,20,16,0.06)" }}>
            {/* Column headers */}
            <div className="table-row" style={{ height:40, cursor:"default", background:"#FDFAF7", borderBottom:"1.5px solid #EDE5D8" }}
              onMouseEnter={()=>{}} >
              <div />
              <div />
              <div />
              {[{key:"pts",label:"PTS"},{key:"gw",label:"GW"},{key:"won",label:"W"},{key:null,label:"D L"}].map((c,i) => (
                <div key={i} className={`col-header${sortBy===c.key?" active":""}`}
                  onClick={() => c.key && setSortBy(c.key)}
                  style={{ textAlign:"center" }}
                >{c.label}</div>
              ))}
              <div className="col-header" style={{ textAlign:"center" }}>Trend</div>
              <div className="col-header" style={{ textAlign:"center" }}>Form</div>
              <div className="col-header">Best Player</div>
            </div>

            {/* Rows */}
            {sorted.map((team, i) => (
              <div
                key={team.id}
                className={`table-row row-appear${team.you?" you":""}`}
                style={{ animationDelay:`${i*0.04}s` }}
                onClick={() => setSelectedTeam(selectedTeam?.id === team.id ? null : team)}
              >
                {/* Rank */}
                <div style={{
                  fontFamily:"'Playfair Display', serif", fontSize:18, fontWeight:900,
                  color: team.rank===1 ? "#FF5A1F" : team.rank<=3 ? "#1C1410" : "#C0B09A",
                }}>{team.rank}</div>

                {/* Change */}
                <div style={{ display:"flex", justifyContent:"center" }}>
                  <RankChange curr={team.rank} prev={team.prev} />
                </div>

                {/* Name */}
                <div style={{ paddingLeft:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:14, fontWeight: team.you ? 600 : 500, color:"#1C1410" }}>{team.name}</span>
                    {team.you && <span style={{ fontFamily:"'DM Mono', monospace", fontSize:8, background:"#FF5A1F", color:"white", padding:"2px 6px", borderRadius:4, letterSpacing:"0.06em" }}>YOU</span>}
                  </div>
                  <div style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:"#C0B09A", marginTop:1, letterSpacing:"0.04em" }}>{team.manager}</div>
                </div>

                {/* PTS */}
                <div style={{ textAlign:"center" }}>
                  <span style={{ fontFamily:"'Playfair Display', serif", fontSize:18, fontWeight:900, color: team.you ? "#FF5A1F" : "#1C1410" }}>{team.pts.toLocaleString()}</span>
                </div>

                {/* GW */}
                <div style={{ textAlign:"center" }}>
                  <span style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:"#A89880" }}>{team.gw}</span>
                </div>

                {/* W */}
                <div style={{ textAlign:"center" }}>
                  <span style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:"#16A34A" }}>{team.won}</span>
                </div>

                {/* D L */}
                <div style={{ textAlign:"center", display:"flex", gap:6, justifyContent:"center" }}>
                  <span style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"#D97706" }}>{team.drawn}</span>
                  <span style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"#C0B09A" }}>·</span>
                  <span style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"#DC2626" }}>{team.lost}</span>
                </div>

                {/* Sparkline */}
                <div style={{ display:"flex", justifyContent:"center" }}>
                  <MiniSparkline teamIdx={team.rank - 1} />
                </div>

                {/* Form */}
                <div style={{ display:"flex", justifyContent:"center" }}>
                  <FormPips form={team.form} />
                </div>

                {/* Hero player */}
                <div style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:"#A89880", letterSpacing:"0.04em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {team.hero}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── FORM GUIDE VIEW ── */}
        {view === "form" && (
          <div style={{ background:"white", borderRadius:"0 16px 16px 16px", border:"1.5px solid #EDE5D8", overflow:"hidden", boxShadow:"0 4px 24px rgba(28,20,16,0.06)" }}>
            {/* GW headers */}
            <div style={{
              display:"grid", gridTemplateColumns:"1fr repeat(5,48px)",
              gap:0, padding:"12px 24px", borderBottom:"1.5px solid #EDE5D8",
              background:"#FDFAF7",
            }}>
              <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:"#C0B09A" }}>Team</span>
              {GW_HISTORY.map(g => (
                <span key={g.gw} style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#C0B09A", textAlign:"center" }}>GW{g.gw}</span>
              ))}
            </div>

            {TEAMS.map((team, ti) => (
              <div key={team.id} style={{
                display:"grid", gridTemplateColumns:"1fr repeat(5,48px)",
                gap:0, padding:"10px 24px", alignItems:"center",
                borderBottom:"1px solid #F5EFE8",
                background: team.you ? "#FFF7F4" : "white",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontFamily:"'Playfair Display', serif", fontSize:16, fontWeight:900, color: team.you ? "#FF5A1F" : "#C0B09A", minWidth:20 }}>{team.rank}</span>
                  <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight: team.you?600:400, color:"#1C1410" }}>{team.name}</span>
                  {team.you && <span style={{ fontFamily:"'DM Mono', monospace", fontSize:8, background:"#FF5A1F", color:"white", padding:"2px 6px", borderRadius:4 }}>YOU</span>}
                </div>
                {GW_HISTORY.map(g => {
                  const score = g.scores[ti];
                  const allScores = g.scores;
                  const rank = [...allScores].sort((a,b)=>b-a).indexOf(score)+1;
                  const isTop3 = rank <= 3;
                  const isBot3 = rank >= allScores.length - 2;
                  return (
                    <div key={g.gw} style={{ textAlign:"center" }}>
                      <div style={{
                        width:36, height:36, borderRadius:9, margin:"0 auto",
                        background: isTop3 ? "rgba(22,163,74,0.12)" : isBot3 ? "rgba(220,38,38,0.08)" : "rgba(28,20,16,0.04)",
                        border: `1px solid ${isTop3 ? "rgba(22,163,74,0.25)" : isBot3 ? "rgba(220,38,38,0.15)" : "transparent"}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        <span style={{ fontFamily:"'DM Mono', monospace", fontSize:11, fontWeight:500, color: isTop3 ? "#16A34A" : isBot3 ? "#DC2626" : "#A89880" }}>{score}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── H2H VIEW ── */}
        {view === "h2h" && (
          <div style={{ background:"white", borderRadius:"0 16px 16px 16px", border:"1.5px solid #EDE5D8", overflow:"auto", boxShadow:"0 4px 24px rgba(28,20,16,0.06)" }}>
            <div style={{ minWidth:700 }}>
              {/* Column labels */}
              <div style={{ display:"grid", gridTemplateColumns:`180px repeat(${TEAMS.length}, 1fr)`, borderBottom:"1.5px solid #EDE5D8", background:"#FDFAF7" }}>
                <div style={{ padding:"12px 16px" }} />
                {TEAMS.map(t => (
                  <div key={t.id} style={{ padding:"10px 4px", textAlign:"center" }}>
                    <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.07em", color: t.you ? "#FF5A1F" : "#C0B09A", textTransform:"uppercase", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {t.name.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>

              {TEAMS.map((rowTeam, ri) => (
                <div key={rowTeam.id} style={{
                  display:"grid", gridTemplateColumns:`180px repeat(${TEAMS.length}, 1fr)`,
                  borderBottom:"1px solid #F5EFE8",
                  background: rowTeam.you ? "#FFF7F4" : "white",
                }}>
                  <div style={{ padding:"10px 16px", display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontFamily:"'Playfair Display', serif", fontSize:14, fontWeight:900, color: rowTeam.you ? "#FF5A1F" : "#C0B09A", minWidth:16 }}>{rowTeam.rank}</span>
                    <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, fontWeight: rowTeam.you?600:400, color:"#1C1410", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rowTeam.name}</span>
                  </div>
                  {TEAMS.map((colTeam, ci) => {
                    if (rowTeam.id === colTeam.id) {
                      return <div key={ci} style={{ background:"#F5EFE8", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"#C0B09A" }}>—</span>
                      </div>;
                    }
                    // Simulated H2H results
                    const w = (rowTeam.rank < colTeam.rank) ? 1 : 0;
                    const d = (Math.abs(rowTeam.rank - colTeam.rank) === 2) ? 1 : 0;
                    const l = w === 0 && d === 0 ? 1 : 0;
                    const result = w ? "W" : d ? "D" : "L";
                    return (
                      <div key={ci} style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"6px 2px" }}>
                        <div className="h2h-cell" style={{
                          background: FORM_BG[result],
                          border: `1px solid ${FORM_COLOR[result]}33`,
                          color: FORM_COLOR[result],
                        }}>{result}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expanded team panel */}
        {selectedTeam && (
          <div style={{
            marginTop:16, background:"white", borderRadius:16,
            border:"1.5px solid #EDE5D8", padding:"24px 28px",
            boxShadow:"0 4px 24px rgba(28,20,16,0.08)",
            animation:"fadeUp 0.25s ease",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                  <h3 style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:900 }}>{selectedTeam.name}</h3>
                  {selectedTeam.you && <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, background:"#FF5A1F", color:"white", padding:"3px 8px", borderRadius:5 }}>YOU</span>}
                </div>
                <p style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"#A89880", letterSpacing:"0.06em" }}>Managed by {selectedTeam.manager} · Rank #{selectedTeam.rank}</p>
              </div>
              <button onClick={() => setSelectedTeam(null)} style={{
                width:28, height:28, borderRadius:7, border:"1.5px solid #EDE5D8",
                background:"white", cursor:"pointer", fontFamily:"'DM Mono', monospace",
                fontSize:12, color:"#A89880",
              }}>✕</button>
            </div>

            <div style={{ display:"flex", gap:12 }}>
              {[
                { label:"Season Pts",  value: selectedTeam.pts.toLocaleString() },
                { label:"GW28 Pts",    value: selectedTeam.gw },
                { label:"Won",         value: selectedTeam.won, color:"#16A34A" },
                { label:"Drawn",       value: selectedTeam.drawn, color:"#D97706" },
                { label:"Lost",        value: selectedTeam.lost, color:"#DC2626" },
                { label:"Pts / Game",  value: (selectedTeam.pts / selectedTeam.played).toFixed(1) },
              ].map(s => (
                <div key={s.label} style={{ flex:1, background:"#FAF7F2", borderRadius:10, padding:"14px 16px", border:"1px solid #EDE5D8" }}>
                  <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#C0B09A", marginBottom:6 }}>{s.label}</p>
                  <p style={{ fontFamily:"'Playfair Display', serif", fontSize:24, fontWeight:900, color: s.color || "#1C1410", lineHeight:1 }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#C0B09A" }}>Last 5</span>
              <FormPips form={selectedTeam.form} />
              <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:"#C0B09A", marginLeft:8 }}>Best player: <span style={{ color:"#FF5A1F" }}>{selectedTeam.hero}</span></span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
