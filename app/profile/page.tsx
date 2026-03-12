"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { NavBar } from "@/components/NavBar";
import { AvatarMenu } from "@/components/AvatarMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/lib/use-is-mobile";

type Badge = { id: string; badge_key: string; badge_name: string; badge_emoji: string; earned_at: string };
type League = { id: string; name: string; season: string; draft_status: string };

const ALL_BADGES = [
  { key: "first_blood",    emoji: "🏆", name: "First Blood",      desc: "Made your first ever draft pick" },
  { key: "on_the_rise",    emoji: "📈", name: "On The Rise",       desc: "3-gameweek winning streak" },
  { key: "the_wall",       emoji: "🧱", name: "The Wall",          desc: "GK + all DEF clean sheet in same gameweek" },
  { key: "lightning_draft",emoji: "⚡", name: "Lightning Draft",   desc: "Completed draft in under 60s avg per pick" },
  { key: "top_of_pops",    emoji: "👑", name: "Top of the Pops",   desc: "Finished a gameweek in 1st place" },
];

export default function ProfilePage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);

  const navLinks = [{ label: "Home", href: "/" }, { label: "Settings", href: "/settings" }];

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setEmail(user.email ?? "");
      setMemberSince(new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      const rawName = profile?.username
        ? profile.username
        : (user.email ?? "").split("@")[0].replace(/[._-]/g, " ");
      const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      setDisplayName(name);
      setNameInput(name);

      const { data: badgesData } = await supabase
        .from("manager_badges")
        .select("id, badge_key, badge_name, badge_emoji, earned_at")
        .eq("user_id", user.id)
        .order("earned_at", { ascending: false });
      setBadges(badgesData ?? []);

      const { data: teamsData } = await supabase
        .from("teams")
        .select("league_id, league:leagues(id, name, season, draft_status)")
        .eq("user_id", user.id);

      const leagueList = (teamsData ?? []).map(t => t.league as unknown as League).filter(Boolean);
      setLeagues(leagueList);

      setLoading(false);
    }
    load();
  }, [router]);

  async function saveName() {
    if (!nameInput.trim() || nameInput === displayName) { setEditingName(false); return; }
    setSavingName(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({ id: user.id, username: nameInput.trim().toLowerCase().replace(/\s+/g, "_") });
      setDisplayName(nameInput.trim());
    }
    setSavingName(false);
    setEditingName(false);
  }

  const earnedKeys = new Set(badges.map(b => b.badge_key));

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--c-text-dim)", letterSpacing: "0.12em" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", overflowX: "hidden" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <NavBar links={navLinks} activeLabel="" right={<><ThemeToggle size="sm" /><AvatarMenu /></>} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "24px 16px" : "40px 40px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF5A1F", marginBottom: 6 }}>Your Account</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 26 : 34, fontWeight: 900, letterSpacing: "-0.02em" }}>
            Profile
          </h1>
        </div>

        {/* Identity card */}
        <div style={{ background: "var(--c-bg-elevated)", borderRadius: 16, border: "1.5px solid var(--c-border-strong)", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, #FF5A1F, #E8400A)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Mono', monospace", fontSize: 20, color: "white", flexShrink: 0,
            }}>
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {editingName ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveName()}
                      autoFocus
                      style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 600,
                        background: "var(--c-bg)", border: "1.5px solid #FF5A1F", borderRadius: 8,
                        padding: "4px 10px", color: "var(--c-text)", outline: "none",
                      }}
                    />
                    <button onClick={saveName} disabled={savingName} style={{ padding: "6px 14px", borderRadius: 7, background: "#FF5A1F", color: "white", border: "none", fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: "pointer", letterSpacing: "0.06em" }}>
                      {savingName ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingName(false)} style={{ padding: "6px 10px", borderRadius: 7, background: "transparent", color: "var(--c-text-muted)", border: "1px solid var(--c-border-strong)", fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 700, color: "var(--c-text)" }}>{displayName}</h2>
                    <button onClick={() => setEditingName(true)} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", color: "var(--c-text-muted)", background: "transparent", border: "1px solid var(--c-border-strong)", borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
                      Edit
                    </button>
                  </>
                )}
              </div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)", marginTop: 3, letterSpacing: "0.04em" }}>{email}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 3 }}>Member Since</p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text)" }}>{memberSince}</p>
            </div>
            <div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 3 }}>Leagues</p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text)" }}>{leagues.length}</p>
            </div>
            <div>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 3 }}>Badges</p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text)" }}>{badges.length} / {ALL_BADGES.length}</p>
            </div>
          </div>
        </div>

        {/* Badge Cabinet */}
        <div id="badges">
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 14 }}>Badge Cabinet</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 10 }}>
            {ALL_BADGES.map(b => {
              const earned = earnedKeys.has(b.key);
              const earnedBadge = badges.find(eb => eb.badge_key === b.key);
              return (
                <div key={b.key} style={{
                  background: earned ? "var(--c-bg-elevated)" : "var(--c-bg)",
                  border: earned ? "1.5px solid var(--c-border-strong)" : "1.5px dashed var(--c-border-strong)",
                  borderRadius: 12, padding: "16px 14px",
                  opacity: earned ? 1 : 0.45,
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <span style={{ fontSize: 28, filter: earned ? "none" : "grayscale(1)" }}>{b.emoji}</span>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--c-text)", lineHeight: 1.2 }}>{b.name}</p>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "var(--c-text-dim)", lineHeight: 1.5 }}>{b.desc}</p>
                  {earned && earnedBadge && (
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#FF5A1F", marginTop: 2 }}>
                      {new Date(earnedBadge.earned_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leagues */}
        {leagues.length > 0 && (
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-text-dim)", marginBottom: 14 }}>Your Leagues</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leagues.map(l => (
                <div key={l.id} style={{ background: "var(--c-bg-elevated)", borderRadius: 12, border: "1.5px solid var(--c-border-strong)", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--c-text)", marginBottom: 2 }}>{l.name}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-muted)", letterSpacing: "0.06em" }}>Season {l.season}</p>
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: l.draft_status === "live" ? "#FF5A1F" : l.draft_status === "complete" ? "#16A34A" : "var(--c-text-muted)" }}>
                    {l.draft_status === "live" ? "● Drafting" : l.draft_status === "complete" ? "Active" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
