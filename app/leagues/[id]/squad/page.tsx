"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ─── DATA ─────────────────────────────────────────────────────────────────────

interface PlayerStats {
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  interceptions: number;
  tackles: number;
  keyPasses: number;
  minsPlayed: number;
}

interface Fixture {
  h: string;
  a: boolean;
  diff: number;
}

interface SquadPlayer {
  id: number;
  name: string;
  short: string;
  club: string;
  clubFull: string;
  pos: "GK" | "DEF" | "MID" | "FWD";
  starting: boolean;
  bench: number | null;
  seasonPts: number;
  gwPts: number;
  cost: string;
  form: number[];
  ownership: number;
  injury: { type: string; detail: string } | null;
  hero?: boolean;
  stats: PlayerStats;
  fixtures: Fixture[];
}

const SQUAD: SquadPlayer[] = [
  // GK
  { id:1,  name:"Pickford",          short:"Pickford",    club:"EVE", clubFull:"Everton",          pos:"GK",  starting:true,  bench:null, seasonPts:112, gwPts:9,  cost:"£4.2m", form:[9,6,12,8,9],   ownership:1,  injury:null,
    stats:{ goals:0, assists:0, cleanSheets:6, saves:38, interceptions:4, tackles:12, keyPasses:1, minsPlayed:2430 },
    fixtures:[{h:"MUN",a:false,diff:2},{h:"TOT",a:true,diff:3},{h:"BRE",a:false,diff:1}] },
  // DEF
  { id:2,  name:"Alexander-Arnold",  short:"Trent",       club:"LIV", clubFull:"Liverpool",        pos:"DEF", starting:true,  bench:null, seasonPts:198, gwPts:14, cost:"£7.1m", form:[14,8,22,11,14], ownership:1,  injury:null,
    stats:{ goals:3, assists:11, cleanSheets:9, saves:0, interceptions:18, tackles:31, keyPasses:42, minsPlayed:2340 },
    fixtures:[{h:"MCI",a:true,diff:4},{h:"ARS",a:false,diff:4},{h:"CHE",a:true,diff:3}] },
  { id:3,  name:"Davies C",          short:"Davies C",    club:"BOU", clubFull:"Bournemouth",      pos:"DEF", starting:true,  bench:null, seasonPts:221, gwPts:17, cost:"£3.8m", form:[17,12,21,9,17], ownership:1,  injury:null, hero:true,
    stats:{ goals:1, assists:2, cleanSheets:7, saves:0, interceptions:74, tackles:89, keyPasses:8, minsPlayed:2430 },
    fixtures:[{h:"BRE",a:false,diff:2},{h:"EVE",a:true,diff:1},{h:"LIV",a:false,diff:5}] },
  { id:4,  name:"Gvardiol",          short:"Gvardiol",    club:"MCI", clubFull:"Man City",         pos:"DEF", starting:true,  bench:null, seasonPts:172, gwPts:6,  cost:"£5.9m", form:[6,14,8,19,6],  ownership:1,  injury:null,
    stats:{ goals:4, assists:6, cleanSheets:11, saves:0, interceptions:31, tackles:44, keyPasses:14, minsPlayed:2250 },
    fixtures:[{h:"LIV",a:false,diff:5},{h:"NEW",a:true,diff:3},{h:"AVL",a:false,diff:3}] },
  // MID
  { id:5,  name:"Salah",             short:"Salah",       club:"LIV", clubFull:"Liverpool",        pos:"MID", starting:true,  bench:null, seasonPts:287, gwPts:22, cost:"£13.2m",form:[22,18,31,14,22],ownership:1,  injury:null,
    stats:{ goals:18, assists:12, cleanSheets:0, saves:0, interceptions:8, tackles:19, keyPasses:61, minsPlayed:2295 },
    fixtures:[{h:"MCI",a:true,diff:4},{h:"ARS",a:false,diff:4},{h:"CHE",a:true,diff:3}] },
  { id:6,  name:"Palmer",            short:"Palmer",      club:"CHE", clubFull:"Chelsea",          pos:"MID", starting:true,  bench:null, seasonPts:261, gwPts:11, cost:"£10.8m",form:[11,24,19,8,11], ownership:1,  injury:null,
    stats:{ goals:14, assists:9, cleanSheets:0, saves:0, interceptions:11, tackles:22, keyPasses:54, minsPlayed:2340 },
    fixtures:[{h:"ARS",a:false,diff:4},{h:"MCI",a:true,diff:4},{h:"LIV",a:false,diff:5}] },
  { id:7,  name:"Mbeumo",            short:"Mbeumo",      club:"BRE", clubFull:"Brentford",        pos:"MID", starting:true,  bench:null, seasonPts:234, gwPts:8,  cost:"£7.4m", form:[8,16,12,21,8],  ownership:1,  injury:null,
    stats:{ goals:12, assists:8, cleanSheets:0, saves:0, interceptions:14, tackles:28, keyPasses:38, minsPlayed:2250 },
    fixtures:[{h:"EVE",a:true,diff:1},{h:"NEW",a:false,diff:3},{h:"TOT",a:true,diff:3}] },
  { id:8,  name:"Nørgaard",          short:"Nørgaard",    club:"BRE", clubFull:"Brentford",        pos:"MID", starting:true,  bench:null, seasonPts:168, gwPts:7,  cost:"£4.1m", form:[7,11,9,14,7],  ownership:1,  injury:null,
    stats:{ goals:2, assists:4, cleanSheets:0, saves:0, interceptions:52, tackles:78, keyPasses:19, minsPlayed:2340 },
    fixtures:[{h:"EVE",a:true,diff:1},{h:"NEW",a:false,diff:3},{h:"TOT",a:true,diff:3}] },
  // FWD
  { id:9,  name:"Watkins",           short:"Watkins",     club:"AVL", clubFull:"Aston Villa",      pos:"FWD", starting:true,  bench:null, seasonPts:198, gwPts:14, cost:"£8.3m", form:[14,6,18,11,14], ownership:1,  injury:null,
    stats:{ goals:14, assists:7, cleanSheets:0, saves:0, interceptions:6, tackles:15, keyPasses:22, minsPlayed:2295 },
    fixtures:[{h:"WOL",a:false,diff:1},{h:"EVE",a:true,diff:1},{h:"MUN",a:false,diff:3}] },
  { id:10, name:"Haaland",           short:"Haaland",     club:"MCI", clubFull:"Man City",         pos:"FWD", starting:true,  bench:null, seasonPts:241, gwPts:7,  cost:"£14.1m",form:[7,22,14,18,7],  ownership:1,  injury:null,
    stats:{ goals:21, assists:3, cleanSheets:0, saves:0, interceptions:2, tackles:8,  keyPasses:9,  minsPlayed:2205 },
    fixtures:[{h:"LIV",a:false,diff:5},{h:"NEW",a:true,diff:3},{h:"AVL",a:false,diff:3}] },
  { id:11, name:"Isak",              short:"Isak",        club:"NEW", clubFull:"Newcastle",         pos:"FWD", starting:true,  bench:null, seasonPts:187, gwPts:3,  cost:"£8.8m", form:[3,9,16,12,3],   ownership:1,  injury:{type:"doubt",detail:"Knock — 75% chance"},
    stats:{ goals:13, assists:5, cleanSheets:0, saves:0, interceptions:4, tackles:11, keyPasses:14, minsPlayed:2115 },
    fixtures:[{h:"TOT",a:false,diff:2},{h:"BRE",a:true,diff:2},{h:"MCI",a:false,diff:4}] },
  // BENCH
  { id:12, name:"Mykolenko",         short:"Mykolenko",   club:"EVE", clubFull:"Everton",          pos:"DEF", starting:false, bench:1,    seasonPts:98,  gwPts:6,  cost:"£2.9m", form:[6,4,8,2,6],    ownership:1,  injury:null,
    stats:{ goals:0, assists:2, cleanSheets:4, saves:0, interceptions:22, tackles:34, keyPasses:6,  minsPlayed:1890 },
    fixtures:[{h:"MUN",a:false,diff:2},{h:"TOT",a:true,diff:3},{h:"BRE",a:false,diff:1}] },
  { id:13, name:"Wissa",             short:"Wissa",       club:"BRE", clubFull:"Brentford",        pos:"FWD", starting:false, bench:2,    seasonPts:143, gwPts:4,  cost:"£5.2m", form:[4,8,6,11,4],   ownership:1,  injury:null,
    stats:{ goals:9, assists:4, cleanSheets:0, saves:0, interceptions:5, tackles:14, keyPasses:16, minsPlayed:1980 },
    fixtures:[{h:"EVE",a:true,diff:1},{h:"NEW",a:false,diff:3},{h:"TOT",a:true,diff:3}] },
  { id:14, name:"Fabianski",         short:"Fabianski",   club:"WHU", clubFull:"West Ham",         pos:"GK",  starting:false, bench:3,    seasonPts:71,  gwPts:2,  cost:"£2.1m", form:[2,4,6,1,2],    ownership:1,  injury:null,
    stats:{ goals:0, assists:0, cleanSheets:3, saves:29, interceptions:1, tackles:2,  keyPasses:0,  minsPlayed:1620 },
    fixtures:[{h:"MUN",a:true,diff:3},{h:"CHE",a:false,diff:3},{h:"ARS",a:true,diff:5}] },
  { id:15, name:"Solanke",           short:"Solanke",     club:"TOT", clubFull:"Tottenham",        pos:"FWD", starting:false, bench:4,    seasonPts:132, gwPts:5,  cost:"£5.9m", form:[5,3,9,7,5],    ownership:1,  injury:null,
    stats:{ goals:8, assists:6, cleanSheets:0, saves:0, interceptions:3, tackles:9,  keyPasses:12, minsPlayed:2070 },
    fixtures:[{h:"EVE",a:false,diff:2},{h:"BRE",a:true,diff:2},{h:"NEW",a:false,diff:3}] },
];

const POS_META: Record<string, { color: string; bg: string; border: string }> = {
  GK:  { color:"#92400E", bg:"#FEF9C3", border:"#FDE68A" },
  DEF: { color:"#1E40AF", bg:"#DBEAFE", border:"#BFDBFE" },
  MID: { color:"#6B21A8", bg:"#F3E8FF", border:"#E9D5FF" },
  FWD: { color:"#C2410C", bg:"#FFF1EC", border:"#FED7AA" },
};

const CLUB_COLORS: Record<string, string> = {
  LIV:"#C8102E", ARS:"#EF0107", MCI:"#6CABDD", CHE:"#034694",
  AVL:"#670E36", BRE:"#E30613", TOT:"#132257", EVE:"#003399",
  NEW:"#241F20", FUL:"#CC0000", MUN:"#DA291C", BOU:"#C0392B",
  WHU:"#7A263A", WOL:"#FDB913",
};

const DIFF_COLOR: (string | null)[] = [null,"#16A34A","#65A30D","#D97706","#EA580C","#DC2626"];

function FormBar({ form }: { form: number[] }) {
  const max = Math.max(...form);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:32 }}>
      {form.map((v,i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{
            width:"100%", borderRadius:"3px 3px 0 0",
            height: `${(v/max)*28}px`,
            background: i===form.length-1 ? "#FF5A1F" : "#F0E8DC",
            transition:"height 0.3s ease",
          }} />
        </div>
      ))}
    </div>
  );
}

function FixturePill({ fix }: { fix: Fixture }) {
  const diffColor = DIFF_COLOR[fix.diff] as string;
  return (
    <div style={{
      padding:"4px 8px", borderRadius:7,
      background: `${diffColor}18`,
      border: `1px solid ${diffColor}33`,
      display:"flex", gap:4, alignItems:"center",
    }}>
      <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:"#A89880" }}>{fix.a ? "A" : "H"}</span>
      <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, fontWeight:500, color:"#1C1410" }}>{fix.h}</span>
      <span style={{ width:6, height:6, borderRadius:"50%", background:diffColor, flexShrink:0 }} />
    </div>
  );
}

// ── PLAYER PROFILE PANEL ──────────────────────────────────────────────────────
function PlayerProfile({ player, onClose }: { player: SquadPlayer; onClose: () => void }) {
  const [tab, setTab] = useState<"overview" | "stats" | "fixtures">("overview");
  const pm = POS_META[player.pos];
  const cc = CLUB_COLORS[player.club] || "#555";

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      display:"flex", alignItems:"flex-end", justifyContent:"flex-end",
      pointerEvents:"none",
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:"absolute", inset:0,
        background:"rgba(28,20,16,0.5)",
        backdropFilter:"blur(4px)",
        pointerEvents:"all",
        animation:"fadeIn 0.2s ease",
      }} />

      {/* Panel */}
      <div style={{
        position:"relative", pointerEvents:"all",
        width:400, height:"100vh",
        background:"#FAF7F2",
        borderLeft:"1px solid #EDE5D8",
        display:"flex", flexDirection:"column",
        animation:"slideInRight 0.25s ease",
        overflowY:"auto",
      }}>
        {/* Header */}
        <div style={{
          background:`linear-gradient(135deg, ${cc} 0%, ${cc}CC 100%)`,
          padding:"28px 24px 22px",
          position:"relative", flexShrink:0,
        }}>
          <button onClick={onClose} style={{
            position:"absolute", top:16, right:16,
            width:28, height:28, borderRadius:7,
            background:"rgba(255,255,255,0.15)",
            border:"1px solid rgba(255,255,255,0.2)",
            color:"white", cursor:"pointer",
            fontFamily:"'DM Mono', monospace", fontSize:12,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>✕</button>

          <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
            <div style={{
              width:56, height:56, borderRadius:14,
              background:"rgba(255,255,255,0.15)",
              border:"2px solid rgba(255,255,255,0.3)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"'Playfair Display', serif",
              fontSize:22, fontWeight:900, color:"white",
            }}>{player.name[0]}</div>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:900, color:"white", lineHeight:1 }}>{player.name}</span>
                {player.hero && <span style={{ fontFamily:"'DM Mono', monospace", fontSize:8, background:"#FF5A1F", color:"white", padding:"2px 7px", borderRadius:4, letterSpacing:"0.06em" }}>HERO</span>}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"rgba(255,255,255,0.7)", letterSpacing:"0.06em" }}>{player.clubFull}</span>
                <span style={{ padding:"2px 7px", borderRadius:5, background:"rgba(255,255,255,0.2)", fontFamily:"'DM Mono', monospace", fontSize:9, color:"white" }}>{player.pos}</span>
              </div>
            </div>
          </div>

          {/* Injury banner */}
          {player.injury && (
            <div style={{ marginTop:14, padding:"8px 12px", borderRadius:8, background:"rgba(220,38,38,0.2)", border:"1px solid rgba(220,38,38,0.3)" }}>
              <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"#FCA5A5", letterSpacing:"0.06em" }}>
                ⚠ {player.injury.type.toUpperCase()} — {player.injury.detail}
              </span>
            </div>
          )}

          {/* Big pts */}
          <div style={{ display:"flex", gap:20, marginTop:16 }}>
            <div>
              <div style={{ fontFamily:"'DM Mono', monospace", fontSize:8, letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(255,255,255,0.45)", marginBottom:3 }}>Season</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:32, fontWeight:900, color:"white", lineHeight:1 }}>{player.seasonPts}</div>
            </div>
            <div style={{ width:1, background:"rgba(255,255,255,0.15)" }} />
            <div>
              <div style={{ fontFamily:"'DM Mono', monospace", fontSize:8, letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(255,255,255,0.45)", marginBottom:3 }}>GW28</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:32, fontWeight:900, color:"white", lineHeight:1 }}>{player.gwPts}</div>
            </div>
            <div style={{ width:1, background:"rgba(255,255,255,0.15)" }} />
            <div>
              <div style={{ fontFamily:"'DM Mono', monospace", fontSize:8, letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(255,255,255,0.45)", marginBottom:3 }}>Cost</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, fontWeight:900, color:"white", lineHeight:1, marginTop:6 }}>{player.cost}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:0, borderBottom:"1px solid #EDE5D8", background:"white", flexShrink:0 }}>
          {(["overview","stats","fixtures"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:"12px 0",
              fontFamily:"'DM Mono', monospace", fontSize:10,
              letterSpacing:"0.08em", textTransform:"uppercase",
              border:"none", background:"transparent", cursor:"pointer",
              color: tab===t ? "#FF5A1F" : "#A89880",
              borderBottom: tab===t ? "2px solid #FF5A1F" : "2px solid transparent",
              transition:"all 0.15s",
            }}>{t}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex:1, padding:"20px 24px", overflowY:"auto" }}>

          {tab === "overview" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {/* GW form chart */}
              <div style={{ background:"white", borderRadius:12, border:"1.5px solid #EDE5D8", padding:"16px 18px" }}>
                <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:"#C0B09A", marginBottom:10 }}>GW Points — Last 5</p>
                <FormBar form={player.form} />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                  {["GW24","GW25","GW26","GW27","GW28"].map((g,i) => (
                    <span key={i} style={{ fontFamily:"'DM Mono', monospace", fontSize:8, color:"#C0B09A", letterSpacing:"0.04em" }}>{g}</span>
                  ))}
                </div>
              </div>

              {/* Key stats grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { label:"Goals",        value:player.stats.goals,         hero:false,        show:true },
                  { label:"Assists",      value:player.stats.assists,        hero:false,        show:true },
                  { label:"Key Passes",   value:player.stats.keyPasses,      hero:false,        show:true },
                  { label:"Clean Sheets", value:player.stats.cleanSheets,    hero:false,        show:true },
                  { label:"Interceptions",value:player.stats.interceptions,  hero:!!player.hero, show:true },
                  { label:"Tackles",      value:player.stats.tackles,        hero:false,        show:true },
                  { label:"Saves",        value:player.stats.saves,          hero:false,        show:player.pos==="GK" },
                  { label:"Mins Played",  value:player.stats.minsPlayed,     hero:false,        show:true },
                ].filter(s => s.show !== false).map(s => (
                  <div key={s.label} style={{
                    background: s.hero ? "#FFF1EC" : "#FAF7F2",
                    border: `1.5px solid ${s.hero ? "#FDDCCC" : "#EDE5D8"}`,
                    borderRadius:10, padding:"12px 14px",
                  }}>
                    <p style={{ fontFamily:"'DM Mono', monospace", fontSize:8, letterSpacing:"0.1em", textTransform:"uppercase", color: s.hero ? "#FF5A1F" : "#C0B09A", marginBottom:5 }}>{s.label}</p>
                    <p style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:900, color: s.hero ? "#FF5A1F" : "#1C1410" }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Ownership note */}
              <div style={{ background:"white", borderRadius:10, border:"1.5px solid #EDE5D8", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"#A89880", letterSpacing:"0.06em" }}>Owned by you in this league</span>
                <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"#FF5A1F" }}>Draft Pick</span>
              </div>
            </div>
          )}

          {tab === "stats" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { cat:"Attacking",  stats:[
                  { label:"Goals",             val:player.stats.goals,        max:25,  hero:false },
                  { label:"Assists",           val:player.stats.assists,       max:15,  hero:false },
                  { label:"Key Passes",        val:player.stats.keyPasses,     max:70,  hero:false },
                ]},
                { cat:"Defensive",  stats:[
                  { label:"Interceptions",     val:player.stats.interceptions, max:80,  hero:!!player.hero },
                  { label:"Tackles Won",       val:player.stats.tackles,       max:100, hero:!!player.hero },
                  { label:"Clean Sheets",      val:player.stats.cleanSheets,   max:15,  hero:false },
                ]},
                { cat:"Appearance", stats:[
                  { label:"Mins Played",       val:player.stats.minsPlayed,    max:2700, hero:false },
                ]},
              ].map(section => (
                <div key={section.cat} style={{ background:"white", borderRadius:12, border:"1.5px solid #EDE5D8", padding:"14px 16px" }}>
                  <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:"#C0B09A", marginBottom:12 }}>{section.cat}</p>
                  {section.stats.map(s => (
                    <div key={s.label} style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color: s.hero ? "#FF5A1F" : "#3D2E22" }}>{s.label}</span>
                        <span style={{ fontFamily:"'Playfair Display', serif", fontSize:14, fontWeight:700, color: s.hero ? "#FF5A1F" : "#1C1410" }}>{s.val}</span>
                      </div>
                      <div style={{ height:5, background:"#F0E8DC", borderRadius:99, overflow:"hidden" }}>
                        <div style={{
                          height:"100%", borderRadius:99,
                          background: s.hero ? "linear-gradient(90deg,#FF5A1F,#E8400A)" : "#C0B09A",
                          width:`${Math.min(100,(s.val/s.max)*100)}%`,
                          transition:"width 0.5s ease",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {tab === "fixtures" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#C0B09A", marginBottom:4 }}>
                Next Fixtures · Difficulty Rating
              </p>
              {player.fixtures.map((f,i) => {
                const diffColor = DIFF_COLOR[f.diff] as string;
                return (
                  <div key={i} style={{ background:"white", border:"1.5px solid #EDE5D8", borderRadius:11, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:diffColor }} />
                      <div>
                        <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:"#A89880", marginRight:6 }}>{f.a ? "Away" : "Home"}</span>
                        <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:14, fontWeight:600, color:"#1C1410" }}>{f.h}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ display:"flex", gap:2 }}>
                        {[1,2,3,4,5].map(d => (
                          <div key={d} style={{ width:8, height:8, borderRadius:2, background: d<=f.diff ? diffColor : "#F0E8DC" }} />
                        ))}
                      </div>
                      <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:diffColor, letterSpacing:"0.06em" }}>
                        {(["","Easy","Favourable","Medium","Tough","Very Hard"] as const)[f.diff]}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div style={{ marginTop:8, padding:"12px 14px", borderRadius:10, background:"#FFF1EC", border:"1.5px solid #FDDCCC" }}>
                <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:"#C2410C", fontWeight:600, marginBottom:3 }}>Fixture Insight</p>
                <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:"#92400E", lineHeight:1.5 }}>
                  {player.hero
                    ? `${player.short}'s interceptions and tackle stats hold value regardless of opponent difficulty.`
                    : `${player.short} has ${player.fixtures.filter(f=>f.diff<=2).length} favourable fixtures coming up.`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function SquadPage() {
  const params = useParams();
  const id = params.id as string;

  const [selectedPlayer, setSelectedPlayer] = useState<SquadPlayer | null>(null);
  const [view, setView]       = useState<"squad" | "stats">("squad");
  const [posFilter, setPosFilter] = useState("ALL");

  const starters = SQUAD.filter(p => p.starting);
  const bench    = SQUAD.filter(p => !p.starting).sort((a,b) => (a.bench ?? 0) - (b.bench ?? 0));

  const totalPts    = starters.reduce((s,p) => s + p.seasonPts, 0);
  const totalGWPts  = starters.reduce((s,p) => s + p.gwPts, 0);
  const topScorer   = [...starters].sort((a,b) => b.seasonPts - a.seasonPts)[0];
  const injured     = SQUAD.filter(p => p.injury).length;

  const filteredSquad = view === "stats"
    ? SQUAD.filter(p => posFilter === "ALL" || p.pos === posFilter)
    : [] as SquadPlayer[];

  return (
    <div style={{ minHeight:"100vh", background:"#FAF7F2", color:"#1C1410" }}>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideInRight { from{transform:translateX(40px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .player-card {
          background:white; border-radius:12px; border:1.5px solid #EDE5D8;
          padding:14px 16px; cursor:pointer; transition:all 0.18s;
          display:flex; align-items:center; gap:12px;
        }
        .player-card:hover { border-color:#FF5A1F; box-shadow:0 4px 16px rgba(255,90,31,0.12); transform:translateY(-1px); }
        .player-card.hero { border-color:#FDDCCC; background:#FFF9F7; }
        .player-card.injured { border-color:#FCA5A5; }

        .pos-btn {
          padding:6px 14px; border-radius:8px; border:1.5px solid #EDE5D8;
          background:transparent; font-family:'DM Mono', monospace; font-size:10px;
          letter-spacing:0.08em; color:#A89880; cursor:pointer; transition:all 0.15s;
        }
        .pos-btn:hover { border-color:#FF5A1F; color:#FF5A1F; }
        .pos-btn.active { background:#FF5A1F; border-color:#FF5A1F; color:white; }

        .view-btn {
          font-family:'DM Mono', monospace; font-size:10px; letter-spacing:0.08em;
          text-transform:uppercase; padding:8px 18px; border-radius:8px; border:none;
          cursor:pointer; transition:all 0.15s; background:transparent; color:#A89880;
        }
        .view-btn:hover { color:#1C1410; background:#F0E8DC; }
        .view-btn.active { background:#FF5A1F; color:white; }

        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:#E8D5C0; border-radius:2px; }
      `}</style>

      {/* NAV */}
      <nav style={{
        height:58, background:"#FAF7F2", borderBottom:"1px solid #EDE5D8",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 44px", position:"sticky", top:0, zIndex:100,
      }}>
        <Link href="/" style={{ display:"flex", alignItems:"center", gap:11, textDecoration:"none" }}>
          <div style={{ width:34, height:34, background:"linear-gradient(135deg,#FF5A1F,#E8400A)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 3px 10px rgba(255,90,31,0.35)" }}>
            <span style={{ color:"white", fontSize:16 }}>◆</span>
          </div>
          <div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, fontWeight:900, letterSpacing:"-0.02em", lineHeight:1, color:"#1C1410" }}>CURTIS</div>
            <div style={{ fontFamily:"'DM Mono', monospace", fontSize:8, letterSpacing:"0.14em", color:"#FF5A1F", textTransform:"uppercase" }}>Draft Football</div>
          </div>
        </Link>
        <div style={{ display:"flex", gap:28 }}>
          <Link href="/" style={{ fontFamily:"'DM Mono', monospace", fontSize:11, letterSpacing:"0.09em", textTransform:"uppercase", color:"#A89880", textDecoration:"none" }}>Home</Link>
          <Link href={`/leagues/${id}/draft`} style={{ fontFamily:"'DM Mono', monospace", fontSize:11, letterSpacing:"0.09em", textTransform:"uppercase", color:"#A89880", textDecoration:"none" }}>Draft</Link>
          <Link href={`/leagues/${id}/scoring`} style={{ fontFamily:"'DM Mono', monospace", fontSize:11, letterSpacing:"0.09em", textTransform:"uppercase", color:"#A89880", textDecoration:"none" }}>Scoring</Link>
          <Link href={`/leagues/${id}/live`} style={{ fontFamily:"'DM Mono', monospace", fontSize:11, letterSpacing:"0.09em", textTransform:"uppercase", color:"#A89880", textDecoration:"none" }}>Live</Link>
          <Link href={`/leagues/${id}/table`} style={{ fontFamily:"'DM Mono', monospace", fontSize:11, letterSpacing:"0.09em", textTransform:"uppercase", color:"#A89880", textDecoration:"none" }}>League</Link>
          <Link href={`/leagues/${id}/squad`} style={{ fontFamily:"'DM Mono', monospace", fontSize:11, letterSpacing:"0.09em", textTransform:"uppercase", color:"#FF5A1F", textDecoration:"none" }}>Squad</Link>
        </div>
        <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#FF5A1F,#E8400A)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono', monospace", fontSize:12, color:"white" }}>JD</div>
      </nav>

      <div style={{ maxWidth:1060, margin:"0 auto", padding:"40px 40px" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
          <div>
            <p style={{ fontFamily:"'DM Mono', monospace", fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", color:"#FF5A1F", marginBottom:6 }}>The Gaffer&apos;s Cup · GW28</p>
            <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:38, fontWeight:900, letterSpacing:"-0.02em", lineHeight:1.05 }}>
              Interception <span style={{ fontStyle:"italic", color:"#FF5A1F" }}>FC</span>
            </h1>
          </div>
          <div style={{ display:"flex", gap:4, background:"#F5EFE8", padding:4, borderRadius:10 }}>
            {([{id:"squad",label:"Squad View"},{id:"stats",label:"Stats View"}] as const).map(v => (
              <button key={v.id} className={`view-btn${view===v.id?" active":""}`} onClick={() => setView(v.id)}>{v.label}</button>
            ))}
          </div>
        </div>

        {/* Stat strip */}
        <div style={{ display:"flex", gap:12, marginBottom:28 }}>
          {[
            { label:"Season Points",  value: totalPts.toLocaleString(),  sub:"Starting XI total",   highlight:false, warn:false },
            { label:"GW28 Points",    value: totalGWPts,                  sub:"This gameweek",        highlight:false, warn:false },
            { label:"Squad Size",     value: `${SQUAD.length}/15`,        sub:"Players registered",   highlight:false, warn:false },
            { label:"Best Player",    value: topScorer.short,             sub:`${topScorer.seasonPts} pts · ${topScorer.pos}`, highlight:true, warn:false },
            { label:"Injuries",       value: injured > 0 ? `${injured} doubt` : "All clear", sub: injured > 0 ? "Check fitness" : "Full squad available", highlight:false, warn:injured>0 },
          ].map(s => (
            <div key={s.label} style={{
              flex:1, background:"white", borderRadius:14,
              border:`1.5px solid ${s.highlight ? "#FDDCCC" : s.warn ? "#FCA5A5" : "#EDE5D8"}`,
              padding:"16px 18px",
            }}>
              <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#C0B09A", marginBottom:6 }}>{s.label}</p>
              <p style={{ fontFamily:"'Playfair Display', serif", fontSize:20, fontWeight:900, color: s.highlight ? "#FF5A1F" : s.warn ? "#DC2626" : "#1C1410", lineHeight:1, marginBottom:3 }}>{s.value}</p>
              <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:"#A89880", letterSpacing:"0.04em" }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── SQUAD VIEW ── */}
        {view === "squad" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:20 }}>

            {/* Player cards */}
            <div>
              {/* Starters by position */}
              {(["GK","DEF","MID","FWD"] as const).map(pos => {
                const posPlayers = starters.filter(p => p.pos === pos);
                const pm = POS_META[pos];
                return (
                  <div key={pos} style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                      <span style={{ padding:"3px 8px", borderRadius:5, background:pm.bg, border:`1px solid ${pm.border}`, fontFamily:"'DM Mono', monospace", fontSize:9, color:pm.color, letterSpacing:"0.08em" }}>{pos}</span>
                      <div style={{ flex:1, height:1, background:"#F0E8DC" }} />
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {posPlayers.map(p => (
                        <div key={p.id} className={`player-card${p.hero?" hero":""}${p.injury?" injured":""}`}
                          onClick={() => setSelectedPlayer(p)}>
                          {/* Club colour dot */}
                          <div style={{ width:36, height:36, borderRadius:10, background:CLUB_COLORS[p.club]||"#555", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <span style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"white", fontWeight:600 }}>{p.club[0]}</span>
                          </div>
                          {/* Name */}
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                              <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:14, fontWeight:600, color:"#1C1410" }}>{p.name}</span>
                              {p.hero && <span style={{ fontFamily:"'DM Mono', monospace", fontSize:8, background:"#FF5A1F", color:"white", padding:"2px 6px", borderRadius:3 }}>HERO</span>}
                              {p.injury && <span style={{ fontFamily:"'DM Mono', monospace", fontSize:8, background:"#FCA5A5", color:"#7F1D1D", padding:"2px 6px", borderRadius:3 }}>⚠ DOUBT</span>}
                            </div>
                            <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:"#A89880", letterSpacing:"0.04em" }}>{p.clubFull}</span>
                          </div>
                          {/* Form mini bars */}
                          <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:20 }}>
                            {p.form.map((v,i) => {
                              const max = Math.max(...p.form);
                              return <div key={i} style={{ width:5, borderRadius:"2px 2px 0 0", height:`${(v/max)*18}px`, background: i===p.form.length-1 ? "#FF5A1F" : "#E8D5C0" }} />;
                            })}
                          </div>
                          {/* GW pts */}
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:900, color: p.hero ? "#FF5A1F" : "#1C1410", lineHeight:1 }}>{p.gwPts}</div>
                            <div style={{ fontFamily:"'DM Mono', monospace", fontSize:8, color:"#C0B09A", marginTop:1 }}>GW28</div>
                          </div>
                          {/* Season pts */}
                          <div style={{ textAlign:"right", flexShrink:0, paddingLeft:12, borderLeft:"1px solid #F0E8DC" }}>
                            <div style={{ fontFamily:"'DM Mono', monospace", fontSize:13, fontWeight:500, color:"#A89880", lineHeight:1 }}>{p.seasonPts}</div>
                            <div style={{ fontFamily:"'DM Mono', monospace", fontSize:8, color:"#C0B09A", marginTop:1 }}>Season</div>
                          </div>
                          <span style={{ color:"#C0B09A", fontSize:12 }}>›</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Bench */}
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <span style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#C0B09A", padding:"3px 8px", borderRadius:5, background:"#F5EFE8", border:"1px solid #EDE5D8" }}>BENCH</span>
                  <div style={{ flex:1, height:1, background:"#F0E8DC", borderStyle:"dashed" }} />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {bench.map(p => (
                    <div key={p.id} className="player-card" onClick={() => setSelectedPlayer(p)}
                      style={{ opacity:0.7, background:"#FDFAF7" }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:"#C0B09A", flexShrink:0 }} />
                      <div style={{ width:30, height:30, borderRadius:8, background:CLUB_COLORS[p.club]||"#555", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color:"white" }}>{p.club[0]}</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:500, color:"#1C1410" }}>{p.name}</span>
                        <div style={{ fontFamily:"'DM Mono', monospace", fontSize:9, color:"#C0B09A", letterSpacing:"0.04em" }}>{p.clubFull} · {p.pos}</div>
                      </div>
                      <div style={{ fontFamily:"'Playfair Display', serif", fontSize:18, fontWeight:700, color:"#A89880" }}>{p.gwPts}</div>
                      <span style={{ color:"#C0B09A", fontSize:12 }}>›</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Next fixture */}
              <div style={{ background:"linear-gradient(135deg,#1C1410,#3D2E22)", borderRadius:14, padding:"18px 20px" }}>
                <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(255,255,255,0.35)", marginBottom:10 }}>Next Deadline</p>
                <p style={{ fontFamily:"'Playfair Display', serif", fontSize:18, fontWeight:700, color:"white", marginBottom:4 }}>GW29 Lineup Lock</p>
                <p style={{ fontFamily:"'DM Mono', monospace", fontSize:11, color:"#FF5A1F", letterSpacing:"0.06em" }}>Fri 14 Mar · 18:30</p>
              </div>

              {/* Top performers */}
              <div style={{ background:"white", borderRadius:14, border:"1.5px solid #EDE5D8", padding:"16px 18px" }}>
                <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:"#C0B09A", marginBottom:12 }}>Top Performers · GW28</p>
                {[...starters].sort((a,b)=>b.gwPts-a.gwPts).slice(0,5).map((p,i) => (
                  <div key={p.id} onClick={() => setSelectedPlayer(p)} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom: i<4?"1px solid #F5EFE8":"none", cursor:"pointer" }}>
                    <span style={{ fontFamily:"'Playfair Display', serif", fontSize:14, fontWeight:900, color:"#C0B09A", minWidth:16 }}>#{i+1}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, fontWeight:500, color:"#1C1410" }}>{p.name}</div>
                      <div style={{ fontFamily:"'DM Mono', monospace", fontSize:8, color:"#C0B09A" }}>{p.pos} · {p.club}</div>
                    </div>
                    <span style={{ fontFamily:"'Playfair Display', serif", fontSize:18, fontWeight:900, color: p.hero ? "#FF5A1F" : "#1C1410" }}>{p.gwPts}</span>
                  </div>
                ))}
              </div>

              {/* Curtis hero callout */}
              <div style={{ background:"#FFF1EC", border:"1.5px solid #FDDCCC", borderRadius:14, padding:"16px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:18 }}>🛡</span>
                  <p style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#FF5A1F" }}>Curtis Hero</p>
                </div>
                <p style={{ fontFamily:"'Playfair Display', serif", fontSize:16, fontWeight:700, color:"#C2410C", marginBottom:4 }}>Davies C · 17 pts GW28</p>
                <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:"#92400E", lineHeight:1.5 }}>74 interceptions this season. Your CB is outscoring half the league&apos;s attackers.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── STATS VIEW ── */}
        {view === "stats" && (
          <div>
            <div style={{ display:"flex", gap:6, marginBottom:16 }}>
              {["ALL","GK","DEF","MID","FWD"].map(p => (
                <button key={p} className={`pos-btn${posFilter===p?" active":""}`} onClick={() => setPosFilter(p)}>{p}</button>
              ))}
            </div>
            <div style={{ background:"white", borderRadius:16, border:"1.5px solid #EDE5D8", overflow:"hidden" }}>
              {/* Header */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 60px 60px 60px 60px 60px", gap:0, padding:"11px 20px", borderBottom:"1.5px solid #EDE5D8", background:"#FDFAF7" }}>
                {["Player","GW28","Season","Goals","Assists","Intcp","Tackles"].map((h,i) => (
                  <span key={i} style={{ fontFamily:"'DM Mono', monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#C0B09A", textAlign: i>0?"center":"left" }}>{h}</span>
                ))}
              </div>
              {filteredSquad.map((p,i) => (
                <div key={p.id} onClick={() => setSelectedPlayer(p)} style={{
                  display:"grid", gridTemplateColumns:"1fr 60px 60px 60px 60px 60px 60px",
                  gap:0, padding:"11px 20px", alignItems:"center",
                  borderBottom: i<filteredSquad.length-1 ? "1px solid #F5EFE8":"none",
                  cursor:"pointer", transition:"background 0.14s",
                  background: p.hero ? "#FFF9F7" : "white",
                }}
                onMouseOver={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background="#FFF7F4"}
                onMouseOut={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background=p.hero?"#FFF9F7":"white"}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:CLUB_COLORS[p.club]||"#555" }} />
                    <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:500, color:"#1C1410" }}>{p.name}</span>
                    {p.hero && <span style={{ fontFamily:"'DM Mono', monospace", fontSize:7, background:"#FF5A1F", color:"white", padding:"1px 5px", borderRadius:3 }}>HERO</span>}
                    {!p.starting && <span style={{ fontFamily:"'DM Mono', monospace", fontSize:7, background:"#F0E8DC", color:"#A89880", padding:"1px 5px", borderRadius:3 }}>BENCH</span>}
                  </div>
                  {[p.gwPts, p.seasonPts, p.stats.goals, p.stats.assists, p.stats.interceptions, p.stats.tackles].map((v,ci) => (
                    <span key={ci} style={{
                      fontFamily: ci<2 ? "'Playfair Display', serif" : "'DM Mono', monospace",
                      fontSize: ci<2 ? 16 : 12,
                      fontWeight: ci<2 ? 700 : 400,
                      color: (ci===0 && p.hero) ? "#FF5A1F" : (ci===4 && p.hero) ? "#FF5A1F" : "#A89880",
                      textAlign:"center",
                    }}>{v}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Player profile panel */}
      {selectedPlayer && <PlayerProfile player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </div>
  );
}
