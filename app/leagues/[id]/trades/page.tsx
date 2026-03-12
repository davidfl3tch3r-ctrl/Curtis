"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Player = { id: string; name: string; club: string; position: string };
type SquadPlayer = { player_id: string; player: Player };
type Team = { id: string; name: string };

type TradeItem = { player_id: string; from_team_id: string; to_team_id: string; player: Player };
type Trade = {
  id: string;
  proposing_team_id: string;
  receiving_team_id: string;
  status: "pending" | "accepted" | "rejected" | "countered" | "cancelled" | "expired";
  message: string | null;
  created_at: string;
  proposing_team: { name: string };
  receiving_team: { name: string };
  items: TradeItem[];
};

const POS_COLOR: Record<string, string> = {
  GK: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B", accepted: "#10B981", rejected: "#EF4444",
  countered: "#8B5CF6", cancelled: "#A89880", expired: "#A89880",
};

export default function TradesPage() {
  const params = useParams();
  const leagueId = params.id as string;

  const [tab, setTab] = useState<"propose" | "incoming" | "outgoing">("incoming");
  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState("");
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [mySquad, setMySquad] = useState<SquadPlayer[]>([]);
  const [leagueTeams, setLeagueTeams] = useState<Team[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  // Propose form state
  const [targetTeamId, setTargetTeamId] = useState("");
  const [targetSquad, setTargetSquad] = useState<SquadPlayer[]>([]);
  const [giving, setGiving] = useState<string[]>([]);   // my player IDs I'm offering
  const [wanting, setWanting] = useState<string[]>([]);  // their player IDs I want
  const [tradeMessage, setTradeMessage] = useState("");
  const [proposeError, setProposeError] = useState("");
  const [proposeLoading, setProposeLoading] = useState(false);

  // Counter modal state
  const [counterTrade, setCounterTrade] = useState<Trade | null>(null);
  const [counterGiving, setCounterGiving] = useState<string[]>([]);
  const [counterWanting, setCounterWanting] = useState<string[]>([]);
  const [counterMessage, setCounterMessage] = useState("");
  const [counterError, setCounterError] = useState("");
  const [counterLoading, setCounterLoading] = useState(false);

  useEffect(() => { load(); }, [leagueId]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: league }, { data: myTeamRow }, { data: teams }] = await Promise.all([
      supabase.from("leagues").select("name").eq("id", leagueId).single(),
      supabase.from("teams").select("id, name").eq("league_id", leagueId).eq("user_id", user.id).single(),
      supabase.from("teams").select("id, name").eq("league_id", leagueId),
    ]);

    if (league) setLeagueName(league.name);
    if (myTeamRow) setMyTeam(myTeamRow);
    const otherTeams = (teams ?? []).filter((t) => t.id !== myTeamRow?.id);
    setLeagueTeams(otherTeams);

    if (myTeamRow) {
      const { data: squad } = await supabase
        .from("squad_players")
        .select("player_id, player:players(id, name, club, position)")
        .eq("team_id", myTeamRow.id)
        .order("player_id");
      setMySquad((squad ?? []) as unknown as SquadPlayer[]);

      // Load trades where I'm proposer or receiver
      const { data: rawTrades } = await supabase
        .from("trades")
        .select(`
          id, proposing_team_id, receiving_team_id, status, message, created_at,
          proposing_team:teams!proposing_team_id(name),
          receiving_team:teams!receiving_team_id(name)
        `)
        .eq("league_id", leagueId)
        .or(`proposing_team_id.eq.${myTeamRow.id},receiving_team_id.eq.${myTeamRow.id}`)
        .order("created_at", { ascending: false });

      // Load items for all trades
      const tradeIds = (rawTrades ?? []).map((t) => t.id);
      const { data: allItems } = tradeIds.length
        ? await supabase
            .from("trade_items")
            .select("trade_id, player_id, from_team_id, to_team_id, player:players(id, name, club, position)")
            .in("trade_id", tradeIds)
        : { data: [] };

      const itemsByTrade = new Map<string, TradeItem[]>();
      for (const item of allItems ?? []) {
        if (!itemsByTrade.has(item.trade_id)) itemsByTrade.set(item.trade_id, []);
        itemsByTrade.get(item.trade_id)!.push(item as unknown as TradeItem);
      }

      setTrades((rawTrades ?? []).map((t) => ({
        ...t,
        proposing_team: Array.isArray(t.proposing_team) ? t.proposing_team[0] : t.proposing_team,
        receiving_team: Array.isArray(t.receiving_team) ? t.receiving_team[0] : t.receiving_team,
        items: itemsByTrade.get(t.id) ?? [],
      })) as Trade[]);
    }

    setLoading(false);
  }

  async function loadTargetSquad(teamId: string) {
    if (!teamId) { setTargetSquad([]); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from("squad_players")
      .select("player_id, player:players(id, name, club, position)")
      .eq("team_id", teamId);
    setTargetSquad((data ?? []) as unknown as SquadPlayer[]);
    setGiving([]);
    setWanting([]);
  }

  function toggleSelect(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function proposeTrade() {
    if (!myTeam || !targetTeamId) return;
    if (!giving.length && !wanting.length) { setProposeError("Select at least one player"); return; }
    setProposeError("");
    setProposeLoading(true);

    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId, proposingTeamId: myTeam.id, receivingTeamId: targetTeamId,
        giving, receiving: wanting, message: tradeMessage || undefined,
      }),
    });
    const data = await res.json();
    setProposeLoading(false);
    if (!res.ok) { setProposeError(data.error ?? "Failed"); return; }

    setGiving([]); setWanting([]); setTradeMessage(""); setTargetTeamId("");
    setTab("outgoing");
    load();
  }

  async function respond(tradeId: string, action: "accept" | "reject") {
    if (!myTeam) return;
    await fetch(`/api/trades/${tradeId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, receivingTeamId: myTeam.id }),
    });
    load();
  }

  async function submitCounter() {
    if (!counterTrade || !myTeam) return;
    if (!counterGiving.length && !counterWanting.length) { setCounterError("Select at least one player"); return; }
    setCounterError("");
    setCounterLoading(true);

    const res = await fetch(`/api/trades/${counterTrade.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "counter",
        receivingTeamId: myTeam.id,
        counterGiving,
        counterReceiving: counterWanting,
        message: counterMessage || undefined,
      }),
    });
    const data = await res.json();
    setCounterLoading(false);
    if (!res.ok) { setCounterError(data.error ?? "Failed"); return; }

    setCounterTrade(null); setCounterGiving([]); setCounterWanting([]); setCounterMessage("");
    load();
  }

  const incoming = trades.filter((t) => t.receiving_team_id === myTeam?.id);
  const outgoing = trades.filter((t) => t.proposing_team_id === myTeam?.id);
  const navLinks = [
    { label: "Home",     href: "/" },
    { label: "Draft",    href: `/leagues/${leagueId}/draft` },
    { label: "Live",     href: `/leagues/${leagueId}/live` },
    { label: "Table",    href: `/leagues/${leagueId}/table` },
    { label: "Waivers",  href: `/leagues/${leagueId}/waivers` },
    { label: "Trades",   href: `/leagues/${leagueId}/trades` },
    { label: "Chat",     href: `/leagues/${leagueId}/chat` },
    { label: "Messages", href: `/leagues/${leagueId}/messages` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", color: "#1C1410" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .nav-link { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: #A89880; text-decoration: none; transition: color 0.15s; }
        .nav-link:hover, .nav-link.active { color: #FF5A1F; }
        .tab-btn { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.15s; background: transparent; color: #A89880; }
        .tab-btn.active { background: #FF5A1F; color: white; }
        .trade-card { background: white; border-radius: 12px; border: 1.5px solid #EDE5D8; padding: 18px 20px; }
        .player-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; background: #F7F3EE; border-radius: 6px; font-size: 12px; margin: 3px; cursor: pointer; border: 1.5px solid #EDE5D8; transition: all 0.15s; user-select: none; }
        .player-chip.selected { border-color: #FF5A1F; background: #FFF5F0; }
        .player-chip:hover { border-color: #FF5A1F; }
        .pos-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .action-btn { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.07em; padding: 7px 16px; border-radius: 8px; border: 1.5px solid; cursor: pointer; transition: all 0.15s; }
        .accept-btn { border-color: #10B981; color: #10B981; background: white; }
        .accept-btn:hover { background: #10B981; color: white; }
        .reject-btn { border-color: #EF4444; color: #EF4444; background: white; }
        .reject-btn:hover { background: #EF4444; color: white; }
        .counter-btn { border-color: #8B5CF6; color: #8B5CF6; background: white; }
        .counter-btn:hover { background: #8B5CF6; color: white; }
        .primary-btn { padding: 11px 24px; border-radius: 10px; border: none; background: #FF5A1F; color: white; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.15s; }
        .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .section-label { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #A89880; margin-bottom: 8px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; overflow-y: auto; }
        .modal { background: white; border-radius: 16px; padding: 28px; width: 100%; max-width: 640px; }
        .input { width: 100%; padding: 10px 14px; border: 1.5px solid #EDE5D8; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.15s; }
        .input:focus { border-color: #FF5A1F; }
        select.input { background: white; cursor: pointer; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #EDE5D8", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 28, background: "white" }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#FF5A1F" }}>CURTIS</span>
        {navLinks.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link${l.href.includes("trades") ? " active" : ""}`}>{l.label}</Link>
        ))}
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "#A89880", marginBottom: 4 }}>{leagueName}</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900 }}>Trade Centre</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#F0EAE0", borderRadius: 10, padding: 4, marginBottom: 24, width: "fit-content" }}>
          {(["incoming", "outgoing", "propose"] as const).map((t) => (
            <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t === "incoming" ? `Incoming${incoming.filter(x => x.status === "pending").length ? ` (${incoming.filter(x => x.status === "pending").length})` : ""}` : t === "outgoing" ? "Outgoing" : "Propose Trade"}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "#A89880", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Loading…</div>
        ) : tab === "propose" ? (
          /* ── PROPOSE TAB ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p className="section-label">Select Opponent</p>
              <select
                className="input"
                value={targetTeamId}
                onChange={(e) => { setTargetTeamId(e.target.value); loadTargetSquad(e.target.value); }}
              >
                <option value="">— Choose a team —</option>
                {leagueTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {targetTeamId && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div>
                    <p className="section-label">Your Players — Offering</p>
                    <div style={{ background: "#F7F3EE", borderRadius: 10, padding: 12, minHeight: 80 }}>
                      {mySquad.map((sp) => (
                        <span
                          key={sp.player_id}
                          className={`player-chip${giving.includes(sp.player_id) ? " selected" : ""}`}
                          onClick={() => toggleSelect(giving, setGiving, sp.player_id)}
                        >
                          <span className="pos-dot" style={{ background: POS_COLOR[sp.player?.position] ?? "#A89880" }} />
                          {sp.player?.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="section-label">Their Players — Requesting</p>
                    <div style={{ background: "#F7F3EE", borderRadius: 10, padding: 12, minHeight: 80 }}>
                      {targetSquad.map((sp) => (
                        <span
                          key={sp.player_id}
                          className={`player-chip${wanting.includes(sp.player_id) ? " selected" : ""}`}
                          onClick={() => toggleSelect(wanting, setWanting, sp.player_id)}
                        >
                          <span className="pos-dot" style={{ background: POS_COLOR[sp.player?.position] ?? "#A89880" }} />
                          {sp.player?.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {(giving.length > 0 || wanting.length > 0) && (
                  <div style={{ background: "#F7F3EE", borderRadius: 10, padding: 14, fontSize: 13, color: "#6B5E52" }}>
                    You give: <strong>{giving.length ? mySquad.filter(s => giving.includes(s.player_id)).map(s => s.player?.name).join(", ") : "nothing"}</strong>
                    {" · "}
                    You get: <strong>{wanting.length ? targetSquad.filter(s => wanting.includes(s.player_id)).map(s => s.player?.name).join(", ") : "nothing"}</strong>
                  </div>
                )}

                <div>
                  <p className="section-label">Message (optional)</p>
                  <textarea
                    className="input"
                    value={tradeMessage}
                    onChange={(e) => setTradeMessage(e.target.value)}
                    placeholder="Add a message to your trade offer…"
                    rows={2}
                    style={{ resize: "none" }}
                  />
                </div>

                {proposeError && <p style={{ color: "#EF4444", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{proposeError}</p>}

                <button onClick={proposeTrade} disabled={proposeLoading} className="primary-btn" style={{ alignSelf: "flex-start" }}>
                  {proposeLoading ? "Sending…" : "Send Trade Offer"}
                </button>
              </>
            )}
          </div>
        ) : (
          /* ── INCOMING / OUTGOING TABS ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(tab === "incoming" ? incoming : outgoing).length === 0 && (
              <p style={{ color: "#A89880", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
                {tab === "incoming" ? "No incoming trade offers." : "No outgoing trade offers."}
              </p>
            )}
            {(tab === "incoming" ? incoming : outgoing).map((trade) => {
              const isIncoming = tab === "incoming";
              const giving = trade.items.filter((i) => i.to_team_id === myTeam?.id);
              const receiving = trade.items.filter((i) => i.from_team_id === myTeam?.id);

              return (
                <div key={trade.id} className="trade-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>
                        {isIncoming ? trade.proposing_team?.name : trade.receiving_team?.name}
                      </p>
                      <p style={{ fontSize: 12, color: "#A89880", fontFamily: "'DM Mono', monospace" }}>
                        {new Date(trade.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.06em", padding: "3px 9px", borderRadius: 5, background: `${STATUS_COLOR[trade.status]}20`, color: STATUS_COLOR[trade.status], textTransform: "uppercase" }}>
                      {trade.status}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <p className="section-label">You receive</p>
                      {giving.length ? giving.map((item) => (
                        <span key={item.player_id} className="player-chip" style={{ cursor: "default" }}>
                          <span className="pos-dot" style={{ background: POS_COLOR[item.player?.position] ?? "#A89880" }} />
                          {item.player?.name}
                        </span>
                      )) : <span style={{ fontSize: 12, color: "#A89880" }}>Nothing</span>}
                    </div>
                    <span style={{ color: "#A89880", fontSize: 18 }}>⇄</span>
                    <div>
                      <p className="section-label">You give</p>
                      {receiving.length ? receiving.map((item) => (
                        <span key={item.player_id} className="player-chip" style={{ cursor: "default" }}>
                          <span className="pos-dot" style={{ background: POS_COLOR[item.player?.position] ?? "#A89880" }} />
                          {item.player?.name}
                        </span>
                      )) : <span style={{ fontSize: 12, color: "#A89880" }}>Nothing</span>}
                    </div>
                  </div>

                  {trade.message && (
                    <p style={{ fontSize: 13, color: "#6B5E52", fontStyle: "italic", marginBottom: 12 }}>"{trade.message}"</p>
                  )}

                  {trade.status === "pending" && isIncoming && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="action-btn accept-btn" onClick={() => respond(trade.id, "accept")}>Accept</button>
                      <button className="action-btn counter-btn" onClick={() => {
                        setCounterTrade(trade);
                        setCounterGiving([]);
                        setCounterWanting([]);
                        setCounterMessage("");
                        setCounterError("");
                      }}>Counter</button>
                      <button className="action-btn reject-btn" onClick={() => respond(trade.id, "reject")}>Reject</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Counter-offer Modal */}
      {counterTrade && myTeam && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCounterTrade(null); }}>
          <div className="modal">
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Counter Offer</h2>
            <p style={{ color: "#6B5E52", fontSize: 13, marginBottom: 20 }}>
              vs {counterTrade.proposing_team?.name}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <p className="section-label">Your Players — Offering</p>
                <div style={{ background: "#F7F3EE", borderRadius: 10, padding: 10, minHeight: 60 }}>
                  {mySquad.map((sp) => (
                    <span key={sp.player_id} className={`player-chip${counterGiving.includes(sp.player_id) ? " selected" : ""}`} onClick={() => toggleSelect(counterGiving, setCounterGiving, sp.player_id)}>
                      <span className="pos-dot" style={{ background: POS_COLOR[sp.player?.position] ?? "#A89880" }} />
                      {sp.player?.name}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="section-label">Their Players — Requesting</p>
                <div style={{ background: "#F7F3EE", borderRadius: 10, padding: 10, minHeight: 60 }}>
                  {/* Load the proposing team's squad for counter selection */}
                  {counterTrade.items.filter(i => i.from_team_id === counterTrade.proposing_team_id).map((item) => (
                    <span key={item.player_id} className={`player-chip${counterWanting.includes(item.player_id) ? " selected" : ""}`} onClick={() => toggleSelect(counterWanting, setCounterWanting, item.player_id)}>
                      <span className="pos-dot" style={{ background: POS_COLOR[item.player?.position] ?? "#A89880" }} />
                      {item.player?.name}
                    </span>
                  ))}
                  <p style={{ fontSize: 11, color: "#A89880", fontFamily: "'DM Mono', monospace" }}>Players from original offer shown · propose new via Propose tab</p>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p className="section-label">Message (optional)</p>
              <textarea className="input" value={counterMessage} onChange={(e) => setCounterMessage(e.target.value)} placeholder="Add a message…" rows={2} style={{ resize: "none" }} />
            </div>

            {counterError && <p style={{ color: "#EF4444", fontSize: 13, marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>{counterError}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setCounterTrade(null)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #EDE5D8", background: "white", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.08em" }}>Cancel</button>
              <button onClick={submitCounter} disabled={counterLoading} className="primary-btn" style={{ flex: 2 }}>
                {counterLoading ? "Sending…" : "Send Counter Offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
