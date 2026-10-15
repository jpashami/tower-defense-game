export type DifficultyKey = 'easy' | 'normal' | 'hard';

export interface DifficultyDef {
  key: DifficultyKey;
  name: string;
  description: string;
  startMoney: number;
  startLives: number;
  /** Enemy health multiplier on wave 1. */
  hpBase: number;
  /** Extra enemy health added per wave, as a fraction of base (0.25 = +25% per wave). */
  hpGrowth: number;
  /** Multiplier on gold paid per kill. */
  rewardMult: number;
  /** HUD text colour. */
  color: string;
}

export const DIFFICULTIES: Record<DifficultyKey, DifficultyDef> = {
  easy: {
    key: 'easy',
    name: 'Easy',
    description: 'Weaker enemies, bigger rewards.',
    startMoney: 200,
    startLives: 30,
    hpBase: 0.85,
    hpGrowth: 0.15,
    rewardMult: 1.2,
    color: '#a7f070',
  },
  normal: {
    key: 'normal',
    name: 'Normal',
    description: 'The intended challenge.',
    startMoney: 150,
    startLives: 20,
    hpBase: 1,
    hpGrowth: 0.25,
    rewardMult: 1,
    color: '#ffcd75',
  },
  hard: {
    key: 'hard',
    name: 'Hard',
    description: 'Tougher enemies, smaller rewards.',
    startMoney: 125,
    startLives: 10,
    hpBase: 1.15,
    hpGrowth: 0.32,
    rewardMult: 0.9,
    color: '#ef7d57',
  },
};

export const DIFFICULTY_ORDER: DifficultyKey[] = ['easy', 'normal', 'hard'];
export const DEFAULT_DIFFICULTY: DifficultyKey = 'normal';

/** Enemy health multiplier for a wave (1-based) on this difficulty. */
export function enemyHpMultiplier(d: DifficultyDef, waveNumber: number): number {
  return d.hpBase * (1 + d.hpGrowth * (waveNumber - 1));
}

/** Gold paid for a kill on this difficulty. */
export function killReward(d: DifficultyDef, baseReward: number): number {
  return Math.max(1, Math.round(baseReward * d.rewardMult));
}

const STORAGE_KEY = 'pixel-td-difficulty';

/** Last difficulty the player picked, remembered in the browser. */
export function loadDifficulty(): DifficultyKey {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && v in DIFFICULTIES) return v as DifficultyKey;
  } catch {
    // Storage blocked (private window etc.): use the default.
  }
  return DEFAULT_DIFFICULTY;
}

export function saveDifficulty(key: DifficultyKey): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Not critical.
  }
}
