export interface UserStats {
  exactScores: number;
  correctResults: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: 'user' | 'admin';
  totalPoints: number;
  stats: UserStats;
  livePoints?: number;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  group: string; // e.g. 'Group A', 'Group B', ..., 'Group L'
  matchday: number; // 1, 2, 3 for group stage, and knockout stages afterwards (e.g. 4 for Round of 32, 5 for Round of 16, etc.)
  date: string; // ISO string format
  status: 'scheduled' | 'live' | 'finished';
  homeScore?: number;
  awayScore?: number;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  pointsEarned?: number; // Optional, useful for calculating score later
  locked?: boolean;
}

export interface Group {
  id: string;
  name: string;
  creatorId: string;
  inviteCode: string;
  members: string[]; // array of userIds
}
