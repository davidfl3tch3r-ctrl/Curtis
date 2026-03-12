"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type LeagueInfo = {
  id: string;
  name: string;
  season: string;
  format: string;
  max_teams: number;
  commissioner_id: string;
};

export default function JoinLeaguePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();

      const { data: leagueData } = await supabase
        .from("leagues")
        .select("id, name, season, format, max_teams, commissioner_id")
        .eq("invite_code", code)
        .single();

      if (!leagueData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLeague(leagueData);

      const { count } = await supabase
        .from("teams")
        .select("*", { count: "exact", head: true })
        .eq("league_id", leagueData.id);

      setTeamCount(count ?? 0);

      if (user) {
        const { data: existingTeam } = await supabase
          .from("teams")
          .select("id")
          .eq("league_id", leagueData.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingTeam) setAlreadyMember(true);
      }

      setLoading(false);
    }

    load();
  }, [code]);

  async function handleJoin() {
    if (!teamName.trim() || !league) return;
    setJoining(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be signed in to join a league.");
      setJoining(false);
      return;
    }

    if (teamCount >= league.max_teams) {
      setError("This league is full.");
      setJoining(false);
      return;
    }

    // Ensure profile exists before inserting the team (FK requirement)
    await supabase.from("profiles").upsert(
      { id: user.id, email: user.email!, username: user.email!.split("@")[0] },
      { onConflict: "id", ignoreDuplicates: true }
    );

    const { error: insertErr } = await supabase.from("teams").insert({
      league_id: league.id,
      user_id: user.id,
      name: teamName.trim(),
      draft_position: teamCount + 1,
    });

    if (insertErr) {
      setError(
        insertErr.code === "23505"
          ? "You have already joined this league."
          : insertErr.message
      );
      setJoining(false);
      return;
    }

    router.push("/");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "16px",
    color: "#1C1410",
    background: "#FAF7F2",
    border: "1.5px solid #E8E0D8",
    borderRadius: "10px",
    outline: "none",
    boxSizing: "border-box",
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#FAF7F2",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#A89880", letterSpacing: "0.1em" }}>
          Loading…
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{
        minHeight: "100vh", background: "#FAF7F2",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 16, padding: "24px", textAlign: "center",
      }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#1C1410" }}>
          League not found.
        </h1>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#9C8A7A" }}>
          This invite link may have expired or the code is incorrect.
        </p>
        <button
          onClick={() => router.push("/")}
          style={{
            marginTop: 8, padding: "12px 24px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#FF5A1F,#E8400A)", color: "white",
            fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.08em",
            cursor: "pointer",
          }}
        >
          Back to Hub
        </button>
      </div>
    );
  }

  const isFull = teamCount >= (league?.max_teams ?? 99);
  const formatLabel = league?.format === "h2h" ? "Head-to-Head" : "Points League";

  return (
    <div style={{
      minHeight: "100vh", background: "#FAF7F2",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 900, letterSpacing: "0.08em", color: "#1C1410" }}>
            CURTIS
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9C8A7A", marginTop: 6 }}>
            Draft Football
          </div>
        </div>

        {/* Card */}
        <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "32px 32px 28px", border: "1.5px solid #E8E0D8" }}>

          {/* League info */}
          <div style={{
            background: "#FAF7F2", borderRadius: 10, padding: "16px 18px",
            marginBottom: 24, border: "1px solid #EDE5D8",
          }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A89880", marginBottom: 6 }}>
              You&apos;ve been invited to
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#1C1410", marginBottom: 4 }}>
              {league?.name}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880" }}>{formatLabel}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880" }}>·</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: isFull ? "#C0392B" : "#16A34A" }}>
                {teamCount} / {league?.max_teams} managers
              </span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880" }}>·</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A89880" }}>{league?.season}</span>
            </div>
          </div>

          {alreadyMember ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1C1410", marginBottom: 6 }}>
                You&apos;re already in this league.
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9C8A7A" }}>
                Head to the hub to manage your squad.
              </p>
              <button
                onClick={() => router.push("/")}
                style={{
                  marginTop: 20, width: "100%", padding: "12px",
                  background: "#FF5A1F", color: "white", border: "none",
                  borderRadius: 8, fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15, fontWeight: 600, cursor: "pointer",
                }}
              >
                Go to League Hub
              </button>
            </div>
          ) : isFull ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1C1410", marginBottom: 6 }}>
                This league is full.
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9C8A7A" }}>
                All {league?.max_teams} manager slots have been filled.
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#1C1410", margin: "0 0 20px 0" }}>
                Name your team
              </h2>

              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: "block", fontFamily: "'DM Mono', monospace", fontSize: 10,
                  letterSpacing: "0.1em", textTransform: "uppercase", color: "#9C8A7A", marginBottom: 8,
                }}>
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Interception FC"
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "#FF5A1F")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E0D8")}
                />
              </div>

              {error && (
                <div style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#C0392B",
                  background: "#FDF2F2", border: "1px solid #F5C6C6",
                  borderRadius: 6, padding: "10px 12px", marginBottom: 16,
                }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={joining || !teamName.trim()}
                style={{
                  width: "100%", padding: "13px",
                  background: joining || !teamName.trim() ? "#E8A88A" : "#FF5A1F",
                  color: "white", border: "none", borderRadius: 8,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
                  cursor: joining || !teamName.trim() ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {joining ? "Joining…" : "Join League"}
              </button>
            </>
          )}
        </div>

        {!alreadyMember && !isFull && (
          <p style={{
            textAlign: "center", fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, color: "#A89880", marginTop: 16,
          }}>
            Already have an account?{" "}
            <span
              style={{ color: "#FF5A1F", cursor: "pointer", fontWeight: 500 }}
              onClick={() => router.push("/login")}
            >
              Sign in first.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
