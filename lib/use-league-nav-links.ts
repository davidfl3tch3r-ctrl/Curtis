"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

/**
 * Returns the standard league nav links, hiding "Draft" once the draft is complete.
 * Makes a lightweight parallel query to get draft_status.
 */
export function useLeagueNavLinks(leagueId: string) {
  const [draftComplete, setDraftComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    createClient()
      .from("leagues")
      .select("draft_status")
      .eq("id", leagueId)
      .single()
      .then(({ data }) => {
        setDraftComplete(data?.draft_status === "complete");
      });
  }, [leagueId]);

  return [
    { label: "Home",          href: "/" },
    { label: "My Team",       href: `/leagues/${leagueId}/team` },
    // Hide Draft link once draft is complete (null = loading, show it until we know)
    ...(draftComplete !== true
      ? [{ label: "Draft", href: `/leagues/${leagueId}/draft` }]
      : []),
    { label: "Match Day",     href: `/leagues/${leagueId}/live` },
    { label: "League Table",  href: `/leagues/${leagueId}/table` },
    { label: "Waivers",       href: `/leagues/${leagueId}/waivers` },
    { label: "Trades",        href: `/leagues/${leagueId}/trades` },
    { label: "Chat",          href: `/leagues/${leagueId}/chat` },
    { label: "Messages",      href: `/leagues/${leagueId}/messages` },
    { label: "Settings",      href: `/leagues/${leagueId}/settings` },
    { label: "Scoring",       href: `/leagues/${leagueId}/scoring` },
  ];
}
