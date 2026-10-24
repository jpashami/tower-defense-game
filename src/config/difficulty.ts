import { playerGet, playerSet } from '../profile/players';

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
  /** Multiplier on enemy walking speed. */
  speedMult: number;
  /** Multiplier on how many enemies each wave sends (spawned proportionally faster). */
  countMult: number;
  /** Share of enemies that take an open shortcut (0 to 1). */
  shortcutChance: number;
  /** HUD text colour. */
  color: string;
}

export const DIFFICULTIES: Record<DifficultyKey, DifficultyDef> = {
  easy: {
    key: 'easy',
    name: 'Easy',
    description: 'Gentler enemies, extra gold.',
    startMoney: 175,
    startLives: 25,
    hpBase: 1,
    hpGrowth: 0.14,
    rewardMult: 1.08,
    speedMult: 1,
    countMult: 1,
    shortcutChance: 0.25,
    color: '#a7f070',
  },
  normal: {
    key: 'normal',
    name: 'Normal',
    description: 'A real fight. Plan ahead.',
    startMoney: 150,
    startLives: 20,
    hpBase: 1,
    hpGrowth: 0.17,
    rewardMult: 1,
    speedMult: 1,
    countMult: 1,
    shortcutChance: 0.35,
    color: '#ffcd75',
  },
  hard: {
    key: 'hard',
    name: 'Hard',
    description: 'Faster, bigger waves, less gold.',
    startMoney: 125,
    startLives: 12,
    hpBase: 1,
    hpGrowth: 0.18,
    rewardMult: 0.9,
    speedMult: 1.1,
    countMult: 1.1,
    shortcutChance: 0.5,
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

/** Last difficulty the current player picked. */
export function loadDifficulty(): DifficultyKey {
  const v = playerGet('difficulty');
  return v && v in DIFFICULTIES ? (v as DifficultyKey) : DEFAULT_DIFFICULTY;
}

export function saveDifficulty(key: DifficultyKey): void {
  playerSet('difficulty', key);
}
