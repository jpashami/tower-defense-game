import type { EnemyKey } from './enemies';

/** A batch of identical enemies within a wave. */
export interface SpawnGroup {
  /** A built-in EnemyKey or a version's enemy id. */
  enemy: string;
  count: number;
  /** Seconds between each enemy in the group. */
  interval: number;
  /** Seconds after the wave starts before the first one appears. */
  delay?: number;
}

export interface WaveDef {
  groups: SpawnGroup[];
}

const g = (enemy: EnemyKey, count: number, interval: number, delay = 0): SpawnGroup => ({ enemy, count, interval, delay });

/**
 * The campaign. Elite enemies (knights, wolf riders, shamans, wyverns) arrive
 * in small numbers; a Warlord boss leads waves 5, 10 and 15.
 */
export const WAVES: WaveDef[] = [
  /* 1 */ { groups: [g('grunt', 8, 1.0)] },
  /* 2 */ { groups: [g('grunt', 10, 0.8), g('runner', 6, 0.6, 5)] },
  /* 3 */ { groups: [g('grunt', 12, 0.7), g('knight', 1, 1, 8)] },
  /* 4 */ { groups: [g('runner', 14, 0.45), g('brute', 3, 2.2, 4), g('shaman', 1, 1, 6)] },
  /* 5 */ { groups: [g('grunt', 14, 0.6), g('knight', 2, 3, 4), g('warlord', 1, 1, 10)] },
  /* 6 */ { groups: [g('runner', 16, 0.4), g('wyvern', 2, 3, 3), g('brute', 3, 2, 6)] },
  /* 7 */ { groups: [g('grunt', 20, 0.45), g('knight', 4, 2.5, 5), g('shaman', 2, 4, 7)] },
  /* 8 */ { groups: [g('wolf', 4, 2), g('runner', 16, 0.35, 3), g('wyvern', 3, 2.5, 8)] },
  /* 9 */ { groups: [g('brute', 8, 1.6), g('shaman', 3, 3, 4), g('knight', 5, 2, 6)] },
  /* 10 */ { groups: [g('grunt', 24, 0.35), g('wolf', 5, 1.8, 4), g('wyvern', 4, 2, 8), g('warlord', 1, 1, 12)] },
  /* 11 */ { groups: [g('knight', 8, 1.6), g('shaman', 3, 3, 3), g('runner', 20, 0.3, 6)] },
  /* 12 */ { groups: [g('wolf', 8, 1.2), g('wyvern', 6, 1.6, 5), g('brute', 8, 1.4, 8)] },
  /* 13 */ { groups: [g('grunt', 30, 0.3), g('knight', 8, 1.4, 5), g('shaman', 4, 2.5, 6), g('wolf', 6, 1.5, 10)] },
  /* 14 */ { groups: [g('wyvern', 10, 1.2), g('wolf', 10, 1), g('brute', 10, 1.2, 6), g('shaman', 4, 3, 8)] },
  /* 15 */ {
    groups: [g('knight', 12, 1.2, 3), g('wolf', 10, 1, 6), g('shaman', 5, 3, 5), g('wyvern', 8, 1.4, 9), g('warlord', 2, 8, 12)],
  },
];

/** Gold bonus for clearing a wave. */
export const waveClearBonus = (waveNumber: number): number => 20 + 5 * waveNumber;

/** How many of each enemy a wave sends, for the next-wave preview. */
export function waveSummary(wave: WaveDef, countMult = 1): { enemy: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const grp of wave.groups) {
    const n = Math.max(1, Math.round(grp.count * countMult));
    totals.set(grp.enemy, (totals.get(grp.enemy) ?? 0) + n);
  }
  return [...totals].map(([enemy, count]) => ({ enemy, count }));
}
