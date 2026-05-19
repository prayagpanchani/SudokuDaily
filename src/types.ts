export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  xp: number;
  rank: string;
  totalSolved: number;
  createdAt: string;
}

export interface ScoreEntry {
  id?: string;
  userId: string;
  displayName: string;
  difficulty: Difficulty;
  timeSeconds: number;
  puzzleId: string;
  solvedAt: string;
  isDaily?: boolean;
}

export interface SudokuPuzzle {
  puzzle: string;
  solution: string;
  difficulty: string;
}

export const RANKS = [
  { name: 'Novice', minXp: 0 },
  { name: 'Apprentice', minXp: 500 },
  { name: 'Scribe', minXp: 1500 },
  { name: 'Journeyman', minXp: 3000 },
  { name: 'Scholar', minXp: 5000 },
  { name: 'Sage', minXp: 8000 },
  { name: 'Master', minXp: 12000 },
  { name: 'Grandmaster', minXp: 20000 },
  { name: 'Zen Master', minXp: 35000 },
];

export const getRankFromXp = (xp: number) => {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXp) return RANKS[i].name;
  }
  return RANKS[0].name;
};
