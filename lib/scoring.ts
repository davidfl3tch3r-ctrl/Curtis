// ─────────────────────────────────────────────────────────────────────────────
// CURTIS — Scoring Engine
// Takes normalised player stats → returns fantasy points
// Works with both API-Football data and (later) Opta data
// ─────────────────────────────────────────────────────────────────────────────

import type { CurtisPlayerStats } from "./api-football";

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface ScoringRule {
  stat_key: string;
  stat_label: string;
  stat_group: string;
  fwd_pts: number;
  mid_pts: number;
  def_pts: number;
  gk_pts: number;
}

// ── DEFAULT SCORING MATRIX ────────────────────────────────────────────────────
// These are the CURTIS recommended defaults — commissioners can customise per league.
// Stored in Supabase: scoring_rules table, one row per stat per league.

export const DEFAULT_SCORING_RULES: Omit<ScoringRule, "id" | "league_id">[] = [
  // Attacking
  { stat_key:"goal",             stat_label:"Goal",                 stat_group:"Attacking",  fwd_pts:5,    mid_pts:6,    def_pts:7,    gk_pts:8    },
  { stat_key:"assist",           stat_label:"Assist",               stat_group:"Attacking",  fwd_pts:2.5,  mid_pts:3,    def_pts:3.5,  gk_pts:4    },
  { stat_key:"key_pass",         stat_label:"Key Pass",             stat_group:"Attacking",  fwd_pts:1,    mid_pts:1,    def_pts:1,    gk_pts:1    },
  { stat_key:"shot_on_target",   stat_label:"Shot on Target",       stat_group:"Attacking",  fwd_pts:0.5,  mid_pts:0.5,  def_pts:0.5,  gk_pts:0.5  },
  { stat_key:"big_chance_created",stat_label:"Big Chance Created",  stat_group:"Attacking",  fwd_pts:1,    mid_pts:1,    def_pts:1,    gk_pts:1    },
  { stat_key:"big_chance_missed", stat_label:"Big Chance Missed",   stat_group:"Attacking",  fwd_pts:-0.5, mid_pts:-0.5, def_pts:-0.5, gk_pts:-0.5 },
  // Passing
  { stat_key:"passes_40_80",     stat_label:"40+ Passes @ 80%",    stat_group:"Passing",    fwd_pts:4,    mid_pts:4,    def_pts:4,    gk_pts:4    },
  { stat_key:"passes_50_80",     stat_label:"50+ Passes @ 80%",    stat_group:"Passing",    fwd_pts:4.5,  mid_pts:4.5,  def_pts:4.5,  gk_pts:4.5  },
  { stat_key:"passes_60_80",     stat_label:"60+ Passes @ 80%",    stat_group:"Passing",    fwd_pts:5,    mid_pts:5,    def_pts:5,    gk_pts:5    },
  { stat_key:"corner_won",       stat_label:"Corner Kick Won",      stat_group:"Passing",    fwd_pts:0.5,  mid_pts:0.5,  def_pts:0.5,  gk_pts:0.5  },
  // Appearance
  { stat_key:"mins_1_60",        stat_label:"1–60 Min Played",      stat_group:"Appearance", fwd_pts:1,    mid_pts:1,    def_pts:1,    gk_pts:1    },
  { stat_key:"mins_61_89",       stat_label:"61–89 Min Played",     stat_group:"Appearance", fwd_pts:2,    mid_pts:2,    def_pts:2,    gk_pts:2    },
  { stat_key:"mins_90",          stat_label:"90+ Min Played",       stat_group:"Appearance", fwd_pts:3,    mid_pts:3,    def_pts:3,    gk_pts:3    },
  // Defensive
  { stat_key:"tackle_won",       stat_label:"Tackle Won",           stat_group:"Defensive",  fwd_pts:0.5,  mid_pts:0.5,  def_pts:0.5,  gk_pts:0.5  },
  { stat_key:"interception",     stat_label:"Interception",         stat_group:"Defensive",  fwd_pts:0.5,  mid_pts:0.5,  def_pts:0.5,  gk_pts:0.5  },
  { stat_key:"clean_sheet",      stat_label:"Clean Sheet",          stat_group:"Defensive",  fwd_pts:0,    mid_pts:2,    def_pts:5,    gk_pts:5    },
  { stat_key:"goal_conceded",    stat_label:"Goal Conceded",        stat_group:"Defensive",  fwd_pts:0,    mid_pts:-0.5, def_pts:-1,   gk_pts:-1   },
  { stat_key:"save",             stat_label:"Save",                 stat_group:"Defensive",  fwd_pts:0,    mid_pts:0,    def_pts:0,    gk_pts:0.5  },
  { stat_key:"penalty_save",     stat_label:"Penalty Save",         stat_group:"Defensive",  fwd_pts:0,    mid_pts:0,    def_pts:0,    gk_pts:2    },
  { stat_key:"defensive_error",  stat_label:"Defensive Error",      stat_group:"Defensive",  fwd_pts:-0.5, mid_pts:-0.5, def_pts:-0.5, gk_pts:-0.5 },
  // Discipline
  { stat_key:"yellow_card",      stat_label:"Yellow Card",          stat_group:"Discipline", fwd_pts:-2,   mid_pts:-2,   def_pts:-2,   gk_pts:-2   },
  { stat_key:"red_card",         stat_label:"Red Card",             stat_group:"Discipline", fwd_pts:-4,   mid_pts:-4,   def_pts:-4,   gk_pts:-4   },
  { stat_key:"own_goal",         stat_label:"Own Goal",             stat_group:"Discipline", fwd_pts:-2,   mid_pts:-2,   def_pts:-2,   gk_pts:-2   },
  { stat_key:"penalty_missed",   stat_label:"Penalty Missed",       stat_group:"Discipline", fwd_pts:-2,   mid_pts:-2,   def_pts:-2,   gk_pts:-2   },
  { stat_key:"penalty_conceded", stat_label:"Penalty Conceded",     stat_group:"Discipline", fwd_pts:-1,   mid_pts:-1,   def_pts:-1,   gk_pts:-1   },
  { stat_key:"turnover",         stat_label:"Turnover",             stat_group:"Discipline", fwd_pts:0,    mid_pts:0,    def_pts:0,    gk_pts:0    },
];

function getPts(rule: ScoringRule, position: Position): number {
  switch (position) {
    case "FWD": return rule.fwd_pts;
    case "MID": return rule.mid_pts;
    case "DEF": return rule.def_pts;
    case "GK":  return rule.gk_pts;
  }
}

// ── MAIN CALCULATE FUNCTION ───────────────────────────────────────────────────

export function calculatePoints(
  stats: CurtisPlayerStats,
  position: Position,
  rules: ScoringRule[] = DEFAULT_SCORING_RULES
): { total: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let total = 0;

  const s = stats;

  // Build a map of computed values for each stat_key
  const statValues: Record<string, number> = {
    goal:              s.goals,
    assist:            s.assists,
    key_pass:          s.key_passes,
    shot_on_target:    s.shots_on_target,
    big_chance_created:s.big_chances_created,
    big_chance_missed: s.big_chances_missed,
    passes_40_80:      (s.passes_total >= 40 && s.passes_total < 50 && s.pass_accuracy >= 80) ? 1 : 0,
    passes_50_80:      (s.passes_total >= 50 && s.passes_total < 60 && s.pass_accuracy >= 80) ? 1 : 0,
    passes_60_80:      (s.passes_total >= 60 && s.pass_accuracy >= 80) ? 1 : 0,
    corner_won:        s.corners_won,
    mins_1_60:         (s.minutes_played >= 1  && s.minutes_played <= 60) ? 1 : 0,
    mins_61_89:        (s.minutes_played >= 61 && s.minutes_played <= 89) ? 1 : 0,
    mins_90:           (s.minutes_played >= 90) ? 1 : 0,
    tackle_won:        s.tackles_won,
    interception:      s.interceptions,
    clean_sheet:       (s.goals_conceded === 0 && s.minutes_played >= 60) ? 1 : 0,
    goal_conceded:     s.goals_conceded,
    save:              s.saves,
    penalty_save:      s.penalty_saves,
    defensive_error:   s.defensive_errors,
    yellow_card:       s.yellow_cards,
    red_card:          s.red_cards,
    own_goal:          s.own_goals,
    penalty_missed:    s.penalties_missed,
    penalty_conceded:  s.penalties_conceded,
    turnover:          s.turnovers,
  };

  for (const rule of rules) {
    const val = statValues[rule.stat_key] ?? 0;
    if (val === 0) continue;
    const pts = val * getPts(rule, position);
    if (pts !== 0) {
      breakdown[rule.stat_key] = pts;
      total += pts;
    }
  }

  return { total: Math.round(total * 10) / 10, breakdown };
}
