"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Player = {
  id: string;
  name: string;
  club: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  season_points: number;
  gw_points: number;
};

type SquadPlayer = { id: string; player_id: string; player: Player };

type WaiverBid = {
  id: string;
  player_id: string;
  drop_player_id: string | null;
  bid_amount: number;
  status: "pending" | "won" | "lost" | "cancelled";
  created_at: string;
  player: { name: string; club: string; position: string };
  drop_player: { name: string } | null;
};

const POS_COLOR: Record<string, string> = {
  GK: "#F59E0B", DEF: "#3B82F6", MID: "#10B981", FWD: "#EF4444",
};

export default function WaiversPage() {
  const params = useParams();
  const leagueId = params.id as string;

  const [tab, setTab] = useState<"available" | "mybids">("available");
  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState("");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myCredits, setMyCredits] = useState(0);
  const [gameweekId, setGameweekId] = useState<string | null>(null);
  const [gameweekName, setGameweekName] = useState("");
  const [available, setAvailable] = useState<Player[]>([]);
  const [mySquad, setMySquad] = useState<SquadPlayer[]>([]);
  const [myBids, setMyBids] = useState<WaiverBid[]>([]);
  const [posFilter, setPosFilter] = useState<string>("ALL");

  // Bid modal state
  const [bidTarget, setBidTarget] = useState<Player | null>(null);
  const [bidAmount, setBidAmount] = useState(0);
  const [dropPlayerId, setDropPlayerId] = useState("");
  const [bidError, setBidError] = useState("");
  const [bidLoading, setBidLoading] = useState(false);

  useEffect(() => {
    load();
  }, [leagueId]);

  async function load() {
    setLoading(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: league }, { data: gw }] = await Promise.all([
      supabase.from("leagues").select("name").eq("id", leagueId).single(),
      supabase.from("gameweeks").select("id, name").in("status", ["live", "upcoming"]).order("number").limit(1).maybeSingle(),
    ]);

    if (league) setLeagueName(league.name);
    if (gw) { setGameweekId(gw.id); setGameweekName(gw.name); }

    // Fetch team separately so errors are visible
    const { data: myTeamRow, error: teamErr } = await supabase
      .from("teams")
      .select("id, credits")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (teamErr) console.error("team fetch error:", teamErr);
    if (myTeamRow) {
      setMyTeamId(myTeamRow.id);
      setMyCredits(myTeamRow.credits ?? 0);
    }

    // Players owned in this league
    const { data: leagueTeams } = await supabase.from("teams").select("id").eq("league_id", leagueId);
    const leagueTeamIds = (leagueTeams ?? []).map((t) => t.id);

    const { data: owned } = leagueTeamIds.length
      ? await supabase.from("squad_players").select("player_id").in("team_id", leagueTeamIds)
      : { data: [] };
    const ownedIds = new Set((owned ?? []).map((r) => r.player_id));

    // Available players
    const { data: players } = await supabase
      .from("players")
      .select("id, name, club, position, season_points, gw_points")
      .eq("is_available", true)
      .order("season_points", { ascending: false })
      .limit(100);

    setAvailable((players ?? []).filter((p) => !ownedIds.has(p.id)));

    // My squad
    if (myTeamRow) {
      const { data: squad } = await supabase
        .from("squad_players")
        .select("id, player_id, player:players(id, name, club, position, season_points, gw_points)")
        .eq("team_id", myTeamRow.id);
      setMySquad((squad ?? []) as unknown as SquadPlayer[]);
    }

    // My bids
    if (myTeamRow && gw) {
      const { data: bids } = await supabase
        .from("waiver_bids")
        .select("id, player_id, drop_player_id, bid_amount, status, created_at, player:players!player_id(name, club, position), drop_player:players!drop_player_id(name)")
        .eq("team_id", myTeamRow.id)
        .eq("gameweek_id", gw.id)
        .order("created_at", { ascending: false });
      setMyBids((bids ?? []) as unknown as WaiverBid[]);
    }

    setLoading(false);
  }

  async function placeBid() {
    if (!bidTarget || !myTeamId || !gameweekId) return;
    setBidError("");
    setBidLoading(true);

    const res = await fetch("/api/waivers/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId,
        teamId: myTeamId,
        playerId: bidTarget.id,
        dropPlayerId: dropPlayerId || undefined,
        bidAmount,
        gameweekId,
      }),
    });
    const data = await res.json();
    setBidLoading(false);

    if (!res.ok) { setBidError(data.error ?? "Failed to place bid"); return; }
    setBidTarget(null);
    setBidAmount(0);
    setDropPlayerId("");
    load();
  }

  async function cancelBid(bidId: string) {
    if (!myTeamId) return;
    await fetch("/api/waivers/bid", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bidId, teamId: myTeamId }),
    });
    load();
  }

  const filtered = posFilter === "ALL" ? available : available.filter((p) => p.position === posFilter);
  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Draft", href: `/leagues/${leagueId}/draft` },
    { label: "Live", href: `/leagues/${leagueId}/live` },
    { label: "Table", href: `/leagues/${leagueId}/table` },
    { label: "Waivers", href: `/leagues/${leagueId}/waivers` },
    { label: "Trades", href: `/leagues/${leagueId}/trades` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", color: "#1C1410" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .nav-link { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: #A89880; text-decoration: none; transition: color 0.15s; }
        .nav-link:hover, .nav-link.active { color: #FF5A1F; }
        .tab-btn { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.15s; background: transparent; color: #A89880; }
        .tab-btn.active { background: #FF5A1F; color: white; }
        .player-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: white; border-radius: 10px; border: 1.5px solid #EDE5D8; transition: border-color 0.15s; }
        .player-row:hover { border-color: #FF5A1F; }
        .bid-btn { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em; padding: 6px 14px; border-radius: 7px; border: 1.5px solid #FF5A1F; background: white; color: #FF5A1F; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .bid-btn:hover { background: #FF5A1F; color: white; }
        .pos-badge { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; color: white; flex-shrink: 0; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: white; border-radius: 16px; padding: 28px; width: 100%; max-width: 440px; }
        .input { width: 100%; padding: 10px 14px; border: 1.5px solid #EDE5D8; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.15s; }
        .input:focus { border-color: #FF5A1F; }
        .primary-btn { width: 100%; padding: 12px; border-radius: 10px; border: none; background: #FF5A1F; color: white; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.15s; }
        .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .status-badge { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 5px; text-transform: uppercase; }
        .filter-btn { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.07em; padding: 5px 12px; border-radius: 6px; border: 1.5px solid #EDE5D8; background: white; cursor: pointer; transition: all 0.15s; color: #A89880; }
        .filter-btn.active { border-color: #FF5A1F; color: #FF5A1F; background: #FFF5F0; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #EDE5D8", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 28, background: "white" }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#FF5A1F" }}>CURTIS</span>
        {navLinks.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link${l.href.includes("waivers") ? " active" : ""}`}>{l.label}</Link>
        ))}
        <div style={{ marginLeft: "auto", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#A89880" }}>
          <span style={{ color: "#FF5A1F", fontWeight: 700 }}>{myCredits}</span> credits
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "#A89880", marginBottom: 4 }}>{leagueName} · {gameweekName}</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900 }}>Waiver Wire</h1>
          <p style={{ color: "#6B5E52", fontSize: 13, marginTop: 4 }}>Bid credits to claim free agents. Highest bid wins — ties go to better waiver priority.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#F0EAE0", borderRadius: 10, padding: 4, marginBottom: 24, width: "fit-content" }}>
          {(["available", "mybids"] as const).map((t) => (
            <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t === "available" ? "Available Players" : `My Bids${myBids.filter(b => b.status === "pending").length ? ` (${myBids.filter(b => b.status === "pending").length})` : ""}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "#A89880", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Loading…</div>
        ) : tab === "available" ? (
          <>
            {/* Position filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["ALL", "GK", "DEF", "MID", "FWD"].map((pos) => (
                <button key={pos} className={`filter-btn${posFilter === pos ? " active" : ""}`} onClick={() => setPosFilter(pos)}>{pos}</button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.length === 0 && (
                <p style={{ color: "#A89880", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>No available players.</p>
              )}
              {filtered.map((p) => (
                <div key={p.id} className="player-row">
                  <span className="pos-badge" style={{ background: POS_COLOR[p.position] }}>{p.position}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#A89880", fontFamily: "'DM Mono', monospace" }}>{p.club}</div>
                  </div>
                  <div style={{ textAlign: "right", marginRight: 12 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700 }}>{p.season_points} pts</div>
                    <div style={{ fontSize: 11, color: "#A89880", fontFamily: "'DM Mono', monospace" }}>season</div>
                  </div>
                  <button className="bid-btn" onClick={() => { setBidTarget(p); setBidAmount(0); setDropPlayerId(""); setBidError(""); }}>
                    Bid
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* My Bids tab */
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myBids.length === 0 && (
              <p style={{ color: "#A89880", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>No bids placed this gameweek.</p>
            )}
            {myBids.map((bid) => {
              const statusColors: Record<string, string> = {
                pending: "#F59E0B", won: "#10B981", lost: "#EF4444", cancelled: "#A89880",
              };
              return (
                <div key={bid.id} className="player-row" style={{ justifyContent: "space-between" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{bid.player?.name ?? bid.player_id}</div>
                    <div style={{ fontSize: 12, color: "#A89880", fontFamily: "'DM Mono', monospace" }}>
                      {bid.player?.club} · {bid.player?.position}
                      {bid.drop_player && <> · Drop: {bid.drop_player.name}</>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700 }}>{bid.bid_amount} cr</span>
                    <span className="status-badge" style={{ background: `${statusColors[bid.status]}20`, color: statusColors[bid.status] }}>{bid.status}</span>
                    {bid.status === "pending" && (
                      <button onClick={() => cancelBid(bid.id)} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#EF4444", background: "none", border: "none", cursor: "pointer" }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bid Modal */}
      {bidTarget && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setBidTarget(null); }}>
          <div className="modal">
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Place Bid</h2>
            <p style={{ color: "#6B5E52", fontSize: 13, marginBottom: 20 }}>
              <strong>{bidTarget.name}</strong> · {bidTarget.club} · {bidTarget.position}
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A89880", display: "block", marginBottom: 6 }}>
                Bid Amount <span style={{ color: "#FF5A1F" }}>({myCredits} available)</span>
              </label>
              <input
                type="number"
                min={0}
                max={myCredits}
                value={bidAmount}
                onChange={(e) => setBidAmount(Number(e.target.value))}
                className="input"
                placeholder="0"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A89880", display: "block", marginBottom: 6 }}>
                Drop Player (optional)
              </label>
              <select
                value={dropPlayerId}
                onChange={(e) => setDropPlayerId(e.target.value)}
                className="input"
              >
                <option value="">— Keep squad as-is —</option>
                {mySquad.map((sp) => (
                  <option key={sp.player_id} value={sp.player_id}>
                    {sp.player?.name} ({sp.player?.position} · {sp.player?.club})
                  </option>
                ))}
              </select>
            </div>

            {bidError && (
              <p style={{ color: "#EF4444", fontSize: 13, marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>{bidError}</p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setBidTarget(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #EDE5D8", background: "white", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.08em" }}>
                Cancel
              </button>
              <button onClick={placeBid} disabled={bidLoading || bidAmount > myCredits} className="primary-btn" style={{ flex: 2 }}>
                {bidLoading ? "Placing…" : `Bid ${bidAmount} Credit${bidAmount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
