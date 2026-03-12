import { useState, useEffect, useRef } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const MANAGERS = [
  { id: 1, name: "Interception FC",       initials: "IF", you: true  },
  { id: 2, name: "Big Phil's XI",         initials: "BP", you: false },
  { id: 3, name: "Davies's Army",         initials: "DA", you: false },
  { id: 4, name: "Parking the Bus FC",    initials: "PB", you: false },
  { id: 5, name: "Tiki-Taka United",      initials: "TT", you: false },
  { id: 6, name: "Mourinho's Lot",        initials: "ML", you: false },
  { id: 7, name: "Counter Attack XI",     initials: "CA", you: false },
  { id: 8, name: "High Press Heroes",     initials: "HP", you: false },
];

const PLAYERS = [
  // GK
  { id:1,  name:"Pickford",          club:"EVE", pos:"GK",  rank:1,  pts:112, owned:false },
  { id:2,  name:"Raya",              club:"ARS", pos:"GK",  rank:2,  pts:108, owned:false },
  { id:3,  name:"Flekken",           club:"BRE", pos:"GK",  rank:3,  pts:94,  owned:false },
  { id:4,  name:"Fabianski",         club:"WHU", pos:"GK",  rank:4,  pts:78,  owned:false },
  // DEF
  { id:5,  name:"Alexander-Arnold",  club:"LIV", pos:"DEF", rank:1,  pts:198, owned:false },
  { id:6,  name:"Davies C",          club:"BOU", pos:"DEF", rank:2,  pts:221, owned:false, hero:true },
  { id:7,  name:"Pedro Porro",       club:"TOT", pos:"DEF", rank:3,  pts:187, owned:false },
  { id:8,  name:"Mykolenko",         club:"EVE", pos:"DEF", rank:4,  pts:154, owned:false },
  { id:9,  name:"Timber",            club:"ARS", pos:"DEF", rank:5,  pts:167, owned:false },
  { id:10, name:"Gvardiol",          club:"MCI", pos:"DEF", rank:6,  pts:172, owned:false },
  { id:11, name:"Trippier",          club:"NEW", pos:"DEF", rank:7,  pts:161, owned:false },
  { id:12, name:"Saliba",            club:"ARS", pos:"DEF", rank:8,  pts:148, owned:false },
  // MID
  { id:13, name:"Salah",             club:"LIV", pos:"MID", rank:1,  pts:287, owned:false },
  { id:14, name:"Palmer",            club:"CHE", pos:"MID", rank:2,  pts:261, owned:false },
  { id:15, name:"Mbeumo",            club:"BRE", pos:"MID", rank:3,  pts:234, owned:false },
  { id:16, name:"Saka",              club:"ARS", pos:"MID", rank:4,  pts:218, owned:false },
  { id:17, name:"Andreas",          club:"FUL", pos:"MID", rank:5,  pts:201, owned:false },
  { id:18, name:"Fernandes",         club:"MUN", pos:"MID", rank:6,  pts:187, owned:false },
  { id:19, name:"Gallagher",         club:"AVL", pos:"MID", rank:7,  pts:176, owned:false },
  { id:20, name:"Nørgaard",          club:"BRE", pos:"MID", rank:8,  pts:168, owned:false },
  // FWD
  { id:21, name:"Haaland",           club:"MCI", pos:"FWD", rank:1,  pts:241, owned:false },
  { id:22, name:"Watkins",           club:"AVL", pos:"FWD", rank:2,  pts:198, owned:false },
  { id:23, name:"Isak",              club:"NEW", pos:"FWD", rank:3,  pts:187, owned:false },
  { id:24, name:"Cunha",             club:"WOL", pos:"FWD", rank:4,  pts:176, owned:false },
  { id:25, name:"Núñez",             club:"LIV", pos:"FWD", rank:5,  pts:165, owned:false },
  { id:26, name:"Jackson",           club:"CHE", pos:"FWD", rank:6,  pts:154, owned:false },
  { id:27, name:"Wissa",             club:"BRE", pos:"FWD", rank:7,  pts:143, owned:false },
  { id:28, name:"Solanke",           club:"TOT", pos:"FWD", rank:8,  pts:132, owned:false },
];

// Pre-populate some picks so the board looks alive
const INITIAL_PICKS = [
  { round:1, pick:1, managerId:1, playerId:13 }, // You → Salah
  { round:1, pick:2, managerId:2, playerId:21 }, // Haaland
  { round:1, pick:3, managerId:3, playerId:14 }, // Palmer
  { round:1, pick:4, managerId:4, playerId:22 }, // Watkins
  { round:1, pick:5, managerId:5, playerId:15 }, // Mbeumo
  { round:1, pick:6, managerId:6, playerId:5  }, // TAA
  { round:1, pick:7, managerId:7, playerId:16 }, // Saka
  { round:1, pick:8, managerId:8, playerId:23 }, // Isak
  { round:2, pick:1, managerId:8, playerId:6  }, // Davies C
  { round:2, pick:2, managerId:7, playerId:10 }, // Gvardiol
  { round:2, pick:3, managerId:6, playerId:1  }, // Pickford
];

const ROUNDS = 5;
const TOTAL_PICKS = MANAGERS.length * ROUNDS;
const PICK_TIME = 60;

const POS_META = {
  GK:  { color:"#92400E", bg:"#FEF9C3", border:"#FDE68A" },
  DEF: { color:"#1E40AF", bg:"#DBEAFE", border:"#BFDBFE" },
  MID: { color:"#6B21A8", bg:"#F3E8FF", border:"#E9D5FF" },
  FWD: { color:"#C2410C", bg:"#FFF1EC", border:"#FED7AA" },
};

const CLUB_COLORS = {
  LIV:"#C8102E", ARS:"#EF0107", MCI:"#6CABDD", CHE:"#034694",
  AVL:"#670E36", BRE:"#E30613", TOT:"#132257", EVE:"#003399",
  NEW:"#241F20", FUL:"#CC0000", MUN:"#DA291C", BOU:"#DA291C",
  WHU:"#7A263A", WOL:"#FDB913",
};

function getSnakeOrder(round, numManagers) {
  const base = Array.from({length: numManagers}, (_, i) => i + 1);
  return round % 2 === 0 ? [...base].reverse() : base;
}

function getCurrentPickInfo(pickNumber, numManagers) {
  const round = Math.floor((pickNumber - 1) / numManagers) + 1;
  const posInRound = (pickNumber - 1) % numManagers;
  const order = getSnakeOrder(round, numManagers);
  const managerId = order[posInRound];
  return { round, posInRound, managerId };
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function ClubBadge({ club, size = 24 }) {
  const color = CLUB_COLORS[club] || "#888";
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

function Timer({ seconds, total }) {
  const pct = (seconds / total) * 100;
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
        }}>{seconds}</div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [picks, setPicks] = useState(INITIAL_PICKS);
  const [players, setPlayers] = useState(PLAYERS);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [watchlist, setWatchlist] = useState([6, 17, 24]); // Davies C etc
  const [timer, setTimer] = useState(PICK_TIME);
  const [activeTab, setActiveTab] = useState("available"); // available | watchlist | mysquad
  const [lastPick, setLastPick] = useState(null);
  const [boardView, setBoardView] = useState("board"); // board | rounds
  const timerRef = useRef(null);

  const currentPickNum = picks.length + 1;
  const { round: currentRound, managerId: currentManagerId } = getCurrentPickInfo(currentPickNum, MANAGERS.length);
  const isYourTurn = currentManagerId === 1;
  const isDraftComplete = picks.length >= TOTAL_PICKS;

  const pickedPlayerIds = new Set(picks.map(p => p.playerId));
  const availablePlayers = players.filter(p => !pickedPlayerIds.has(p.id));

  const myPicks = picks.filter(p => p.managerId === 1).map(p => players.find(pl => pl.id === p.playerId)).filter(Boolean);

  // Timer
  useEffect(() => {
    if (isDraftComplete) return;
    setTimer(PICK_TIME);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          // Autopick best available
          const best = availablePlayers[0];
          if (best) makePick(best);
          return PICK_TIME;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentPickNum]);

  const makePick = (player) => {
    if (pickedPlayerIds.has(player.id) || isDraftComplete) return;
    if (!isYourTurn && currentManagerId !== -1) {
      // For demo — allow any pick but show warning
    }
    clearInterval(timerRef.current);
    const newPick = {
      round: currentRound,
      pick: currentPickNum,
      managerId: currentManagerId,
      playerId: player.id,
    };
    setPicks(prev => [...prev, newPick]);
    setLastPick({ player, managerId: currentManagerId });
    setTimeout(() => setLastPick(null), 3000);
  };

  const toggleWatchlist = (id) => {
    setWatchlist(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id]);
  };

  const filteredPlayers = availablePlayers.filter(p => {
    const matchPos = posFilter === "ALL" || p.pos === posFilter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.club.toLowerCase().includes(search.toLowerCase());
    return matchPos && matchSearch;
  });

  const watchlistPlayers = filteredPlayers.filter(p => watchlist.includes(p.id));
  const displayPlayers = activeTab === "watchlist" ? watchlistPlayers
                       : activeTab === "mysquad"   ? myPicks
                       : filteredPlayers;

  // Next few picks preview
  const upcomingPicks = Array.from({length: 6}, (_, i) => {
    const num = currentPickNum + i;
    if (num > TOTAL_PICKS) return null;
    const info = getCurrentPickInfo(num, MANAGERS.length);
    const mgr = MANAGERS.find(m => m.id === info.managerId);
    return { ...info, manager: mgr, pickNum: num };
  }).filter(Boolean);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0F0D0B", color: "#F5F0E8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&display=swap');
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
        .pick-btn:disabled { background: #2A2520; color: #555; cursor: default; transform: none; }

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
          color: #6B5E52;
        }
        .tab-btn:hover { color: #F5F0E8; background: rgba(255,255,255,0.06); }
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
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          color: #F5F0E8;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          outline: none;
          transition: border-color 0.15s;
        }
        .search-input::placeholder { color: #4A3E34; }
        .search-input:focus { border-color: rgba(255,90,31,0.4); }

        .pos-filter-btn {
          padding: 6px 12px;
          border-radius: 7px;
          border: 1px solid rgba(255,255,255,0.08);
          background: transparent;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #6B5E52;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pos-filter-btn:hover { color: #F5F0E8; border-color: rgba(255,255,255,0.2); }
        .pos-filter-btn.active { background: rgba(255,90,31,0.15); color: #FF5A1F; border-color: rgba(255,90,31,0.3); }

        .squad-slot {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 7px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 4px;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .last-pick-toast {
          animation: slideIn 0.3s ease;
        }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #3A2E24; border-radius: 2px; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{
        height: 56, background: "#0A0806",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
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

        {/* Draft status */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          gap: 16, paddingLeft: 20, borderLeft: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6B5E52", marginBottom: 2 }}>Round</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#F5F0E8", lineHeight: 1 }}>{currentRound}</div>
          </div>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.06)" }} />
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6B5E52", marginBottom: 2 }}>Pick</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#F5F0E8", lineHeight: 1 }}>{currentPickNum} <span style={{ fontSize: 11, color: "#4A3E34", fontFamily: "'DM Mono', monospace" }}>/ {TOTAL_PICKS}</span></div>
          </div>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.06)" }} />

          {/* Progress bar */}
          <div style={{ flex: 1, maxWidth: 200 }}>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                background: "linear-gradient(90deg,#FF5A1F,#E8400A)",
                width: `${((currentPickNum - 1) / TOTAL_PICKS) * 100}%`,
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#4A3E34", marginTop: 3, letterSpacing: "0.06em" }}>
              {picks.length} picks made · {TOTAL_PICKS - picks.length} remaining
            </div>
          </div>
        </div>

        {/* Current pick indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "8px 16px", borderRadius: 10,
          background: isYourTurn ? "rgba(255,90,31,0.15)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${isYourTurn ? "rgba(255,90,31,0.3)" : "rgba(255,255,255,0.08)"}`,
        }}>
          {isYourTurn ? (
            <>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5A1F", boxShadow: "0 0 0 3px rgba(255,90,31,0.2)", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#FF5A1F", letterSpacing: "0.08em" }}>YOUR PICK</span>
              <Timer seconds={timer} total={PICK_TIME} />
            </>
          ) : (
            <>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4A3E34" }} />
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#4A3E34", letterSpacing: "0.08em", marginBottom: 1 }}>ON THE CLOCK</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#A89880" }}>
                  {MANAGERS.find(m => m.id === currentManagerId)?.name}
                </div>
              </div>
              <Timer seconds={timer} total={PICK_TIME} />
            </>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 340px", overflow: "hidden" }}>

        {/* LEFT — Draft Board + Player List */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid rgba(255,255,255,0.06)" }}>

          {/* Draft Board */}
          <div style={{
            flexShrink: 0, padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "#0A0806",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4A3E34" }}>
                Draft Board — Snake Order
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {["board","rounds"].map(v => (
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

            {/* Board grid */}
            <div style={{ overflowX: "auto" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: `60px repeat(${MANAGERS.length}, minmax(88px, 1fr))`,
                gap: 3, minWidth: 760,
              }}>
                {/* Header row */}
                <div />
                {MANAGERS.map(m => (
                  <div key={m.id} style={{
                    padding: "5px 6px", borderRadius: 6,
                    background: m.you ? "rgba(255,90,31,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${m.you ? "rgba(255,90,31,0.2)" : "rgba(255,255,255,0.05)"}`,
                    textAlign: "center",
                  }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: m.you ? "#FF5A1F" : "#6B5E52", letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.you ? "YOU" : m.initials}
                    </div>
                  </div>
                ))}

                {/* Rounds */}
                {Array.from({ length: ROUNDS }, (_, rIdx) => {
                  const round = rIdx + 1;
                  const order = getSnakeOrder(round, MANAGERS.length);
                  return [
                    <div key={`r${round}`} style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#4A3E34", letterSpacing: "0.08em",
                    }}>R{round}</div>,
                    ...order.map((managerId, posIdx) => {
                      const pickNum = (rIdx * MANAGERS.length) + posIdx + 1;
                      const pick = picks.find(p => p.round === round && p.managerId === managerId && picks.indexOf(p) === pickNum - 1);
                      const player = pick ? players.find(pl => pl.id === pick.playerId) : null;
                      const isCurrent = pickNum === currentPickNum;
                      const manager = MANAGERS.find(m => m.id === managerId);

                      return (
                        <div key={`${round}-${managerId}`} className="board-cell" style={{
                          background: isCurrent
                            ? "rgba(255,90,31,0.15)"
                            : player
                              ? manager?.you ? "rgba(255,90,31,0.08)" : "rgba(255,255,255,0.03)"
                              : "rgba(255,255,255,0.02)",
                          border: `1px solid ${isCurrent ? "rgba(255,90,31,0.35)" : "rgba(255,255,255,0.04)"}`,
                        }}>
                          {isCurrent && !player ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF5A1F", animation: "pulse 1s infinite" }} />
                              <span style={{ color: "#FF5A1F", fontSize: 9, letterSpacing: "0.06em" }}>LIVE</span>
                            </div>
                          ) : player ? (
                            <>
                              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, color: "#F5F0E8", lineHeight: 1.2, marginBottom: 2 }}>
                                {player.name}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <span style={{
                                  fontSize: 8, padding: "1px 4px", borderRadius: 3,
                                  background: POS_META[player.pos].bg,
                                  color: POS_META[player.pos].color,
                                  fontFamily: "'DM Mono', monospace",
                                }}>{player.pos}</span>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#4A3E34" }}>{player.club}</span>
                              </div>
                            </>
                          ) : (
                            <span style={{ color: "#2A2018", fontFamily: "'DM Mono', monospace", fontSize: 9 }}>—</span>
                          )}
                        </div>
                      );
                    })
                  ];
                })}
              </div>
            </div>
          </div>

          {/* Upcoming picks strip */}
          <div style={{
            flexShrink: 0, padding: "8px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "#0D0B09",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4A3E34", marginRight: 4, flexShrink: 0 }}>Up next:</span>
            {upcomingPicks.map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 7,
                background: p.manager?.you ? "rgba(255,90,31,0.1)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${p.manager?.you ? "rgba(255,90,31,0.2)" : "rgba(255,255,255,0.06)"}`,
                flexShrink: 0,
              }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#4A3E34" }}>#{p.pickNum}</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: p.manager?.you ? "#FF5A1F" : "#A89880", fontWeight: p.manager?.you ? 600 : 400 }}>
                  {p.manager?.you ? "YOU" : p.manager?.initials}
                </span>
              </div>
            ))}
          </div>

          {/* Player browser */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 16px 0" }}>
            {/* Search + filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexShrink: 0 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4A3E34", fontSize: 12 }}>⌕</span>
                <input className="search-input" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["ALL","GK","DEF","MID","FWD"].map(pos => (
                  <button key={pos} className={`pos-filter-btn${posFilter === pos ? " active" : ""}`} onClick={() => setPosFilter(pos)}>{pos}</button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, marginBottom: 8, flexShrink: 0, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 3 }}>
              {[
                { id:"available", label:`Available (${availablePlayers.length})` },
                { id:"watchlist", label:`Watchlist (${watchlist.length})` },
                { id:"mysquad",   label:`My Squad (${myPicks.length})` },
              ].map(t => (
                <button key={t.id} className={`tab-btn${activeTab === t.id ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
              ))}
            </div>

            {/* Column headers */}
            <div style={{
              display: "grid", gridTemplateColumns: "20px 28px 1fr 38px 52px 42px 32px",
              gap: 8, padding: "4px 12px 6px",
              borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0,
            }}>
              {["#","","Player","Pos","Club","Pts",""].map((h,i) => (
                <span key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4A3E34", textAlign: i > 2 ? "center" : "left" }}>{h}</span>
              ))}
            </div>

            {/* Player list */}
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: 12 }}>
              {displayPlayers.length === 0 ? (
                <div style={{ padding: "32px 12px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#4A3E34", letterSpacing: "0.08em" }}>
                  {activeTab === "watchlist" ? "No players on watchlist" : "No players found"}
                </div>
              ) : displayPlayers.map((player, idx) => {
                const isOwned = pickedPlayerIds.has(player.id);
                const onWatchlist = watchlist.includes(player.id);
                if (isOwned && activeTab !== "mysquad") return null;
                const pos = POS_META[player.pos];
                return (
                  <div key={player.id} className={`player-row${isYourTurn && !isOwned ? " your-turn" : ""}`}
                    style={{ opacity: isOwned && activeTab !== "mysquad" ? 0.4 : 1 }}
                  >
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#4A3E34" }}>{idx + 1}</span>
                    <ClubBadge club={player.club} size={22} />
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "#F5F0E8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {player.name}
                      </span>
                      {player.hero && (
                        <span style={{ fontSize: 8, background: "rgba(255,90,31,0.15)", color: "#FF5A1F", fontFamily: "'DM Mono', monospace", padding: "2px 5px", borderRadius: 3, letterSpacing: "0.06em", flexShrink: 0 }}>HERO</span>
                      )}
                    </div>
                    <span className="pos-chip" style={{ background: pos.bg, color: pos.color, border: `1px solid ${pos.border}` }}>{player.pos}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#6B5E52", textAlign: "center" }}>{player.club}</span>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "#FF5A1F", textAlign: "center" }}>{player.pts}</span>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      {activeTab !== "mysquad" && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(player.id); }} style={{
                            width: 22, height: 22, borderRadius: 5, border: "none",
                            background: onWatchlist ? "rgba(255,90,31,0.15)" : "rgba(255,255,255,0.05)",
                            color: onWatchlist ? "#FF5A1F" : "#4A3E34", cursor: "pointer", fontSize: 10,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>{onWatchlist ? "★" : "☆"}</button>
                          <button
                            className="pick-btn"
                            disabled={!isYourTurn || isOwned}
                            onClick={() => isYourTurn && !isOwned && makePick(player)}
                          >Pick</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT — My Squad + Last Pick + Activity */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#0D0B09" }}>

          {/* Last pick toast */}
          {lastPick && (
            <div className="last-pick-toast" style={{
              margin: "10px 14px 0",
              padding: "10px 14px",
              borderRadius: 10,
              background: lastPick.managerId === 1 ? "rgba(255,90,31,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${lastPick.managerId === 1 ? "rgba(255,90,31,0.3)" : "rgba(255,255,255,0.08)"}`,
              display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
            }}>
              <ClubBadge club={lastPick.player.club} size={28} />
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#F5F0E8" }}>{lastPick.player.name}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: lastPick.managerId === 1 ? "#FF5A1F" : "#6B5E52", letterSpacing: "0.06em", marginTop: 2 }}>
                  {lastPick.managerId === 1 ? "✓ Your pick" : `Picked by ${MANAGERS.find(m=>m.id===lastPick.managerId)?.name}`}
                </div>
              </div>
            </div>
          )}

          {/* My Squad */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4A3E34", marginBottom: 10 }}>
              My Squad ({myPicks.length} / {ROUNDS})
            </div>

            {["GK","DEF","MID","FWD"].map(pos => {
              const posPlayers = myPicks.filter(p => p.pos === pos);
              const pm = POS_META[pos];
              return (
                <div key={pos} style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: pm.color, marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ padding: "2px 6px", borderRadius: 4, background: pm.bg, border: `1px solid ${pm.border}` }}>{pos}</span>
                    <span style={{ color: "#4A3E34" }}>{posPlayers.length} picked</span>
                  </div>
                  {posPlayers.map(player => (
                    <div key={player.id} className="squad-slot">
                      <ClubBadge club={player.club} size={22} />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#F5F0E8", flex: 1 }}>{player.name}</span>
                      {player.hero && <span style={{ fontSize: 8, background: "rgba(255,90,31,0.15)", color: "#FF5A1F", fontFamily: "'DM Mono', monospace", padding: "2px 5px", borderRadius: 3 }}>HERO</span>}
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: "#FF5A1F" }}>{player.pts}</span>
                    </div>
                  ))}
                  {posPlayers.length === 0 && (
                    <div style={{ padding: "7px 10px", borderRadius: 7, border: "1px dashed rgba(255,255,255,0.07)", fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#2A2018", letterSpacing: "0.06em" }}>
                      No {pos} picked yet
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pick it for me */}
          {isYourTurn && (
            <div style={{
              margin: "0 14px 14px",
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(255,90,31,0.08)",
              border: "1px solid rgba(255,90,31,0.2)",
              flexShrink: 0,
            }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#FF5A1F", marginBottom: 6, textTransform: "uppercase" }}>
                ⚡ It's your pick!
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#A89880", marginBottom: 10, lineHeight: 1.4 }}>
                Best available: <strong style={{ color: "#F5F0E8" }}>{availablePlayers[0]?.name}</strong> ({availablePlayers[0]?.pos} · {availablePlayers[0]?.pts} pts)
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => makePick(availablePlayers[0])} style={{
                  flex: 1, padding: "9px", borderRadius: 8, border: "none",
                  background: "linear-gradient(135deg,#FF5A1F,#E8400A)",
                  color: "white", fontFamily: "'DM Mono', monospace",
                  fontSize: 11, letterSpacing: "0.07em", cursor: "pointer",
                  boxShadow: "0 3px 12px rgba(255,90,31,0.3)",
                }}>Auto-pick Best</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
