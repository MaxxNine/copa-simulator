import { Match } from '../types';

export interface GroupStandingTeam {
  team: string;
  P: number;    // Points
  J: number;    // Played
  V: number;    // Wins
  E: number;    // Draws
  D: number;    // Losses
  GP: number;   // Goals For (Gols Pró)
  GC: number;   // Goals Against (Gols Contra)
  SG: number;   // Goal Difference (Saldo de Gols)
  '%': number;  // Aproveitamento (%)
}

/**
 * Calculates user points for a single match prediction.
 * - Exact score: 5 points
 * - Correct result + same goal difference (e.g., draws or identical margins): 3 points
 * - Correct result (winner correct but different margin): 2 points
 * - Incorrect result: 0 points
 */
export function calculatePoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number
): number {
  // 1. Exact score match
  if (predHome === realHome && predAway === realAway) {
    return 5;
  }

  // Determine predicted and real outcome
  const predResult = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
  const realResult = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw';

  // 2. Correct result (winner or draw)
  if (predResult === realResult) {
    const predDiff = predHome - predAway;
    const realDiff = realHome - realAway;
    
    // Same goal difference (includes all correct draws since diff is always 0)
    if (predDiff === realDiff) {
      return 3;
    }
    
    // Correct winner but different goal difference
    return 2;
  }

  // 3. Incorrect result
  return 0;
}

/**
 * Calculates the standing table for a given group.
 * Standings are ordered by: Points -> Goal Difference -> Goals For -> Alphabetical Order.
 */
export function calculateGroupStandings(matches: Match[], groupName: string): GroupStandingTeam[] {
  const groupMatches = matches.filter((m) => m.group === groupName);
  
  // Extract all unique team names in the group to initialize standings
  const teamsInGroup = new Set<string>();
  groupMatches.forEach((m) => {
    teamsInGroup.add(m.homeTeam);
    teamsInGroup.add(m.awayTeam);
  });

  const standingsMap: Record<string, GroupStandingTeam> = {};
  teamsInGroup.forEach((team) => {
    standingsMap[team] = {
      team,
      P: 0,
      J: 0,
      V: 0,
      E: 0,
      D: 0,
      GP: 0,
      GC: 0,
      SG: 0,
      '%': 0,
    };
  });

  // Process played/live matches to populate statistics
  groupMatches.forEach((m) => {
    const isPlayed = m.status === 'finished' || m.status === 'live';
    const homeScore = m.homeScore;
    const awayScore = m.awayScore;

    if (isPlayed && homeScore !== undefined && awayScore !== undefined && homeScore !== null && awayScore !== null) {
      const home = standingsMap[m.homeTeam];
      const away = standingsMap[m.awayTeam];

      if (home && away) {
        home.J += 1;
        away.J += 1;
        home.GP += homeScore;
        home.GC += awayScore;
        away.GP += awayScore;
        away.GC += homeScore;

        if (homeScore > awayScore) {
          home.V += 1;
          home.P += 3;
          away.D += 1;
        } else if (homeScore < awayScore) {
          away.V += 1;
          away.P += 3;
          home.D += 1;
        } else {
          home.E += 1;
          home.P += 1;
          away.E += 1;
          away.P += 1;
        }
      }
    }
  });

  // Calculate SG and Aproveitamento (%)
  const standings = Object.values(standingsMap);
  standings.forEach((t) => {
    t.SG = t.GP - t.GC;
    t['%'] = t.J > 0 ? parseFloat(((t.P / (t.J * 3)) * 100).toFixed(1)) : 0;
  });

  // Sort: Points (desc) -> SG (desc) -> GP (desc) -> Alphabetical (asc)
  return standings.sort((a, b) => {
    if (b.P !== a.P) return b.P - a.P;
    if (b.SG !== a.SG) return b.SG - a.SG;
    if (b.GP !== a.GP) return b.GP - a.GP;
    return a.team.localeCompare(b.team);
  });
}
