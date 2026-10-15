import type { EnemyKey } from './enemies';

/** A batch of identical enemies within a wave. */
export interface SpawnGroup {
  enemy: EnemyKey;
  count: number;
  /** Seconds between each enemy in the group. */
  interval: number;
  /** Seconds after the wave starts before the first one appears. */
  delay?: number;
}

export interface WaveDef {
  groups: SpawnGroup[];
}

export const WAVES: WaveDef[] = [
  { groups: [{ enemy: 'grunt', count: 8, interval: 1.1 }] },
  { groups: [{ enemy: 'grunt', count: 12, interval: 0.85 }] },
  {
    groups: [
      { enemy: 'runner', count: 10, interval: 0.6 },
      { enemy: 'grunt', count: 6, interval: 0.9, delay: 7 },
    ],
  },
  {
    groups: [
      { enemy: 'grunt', count: 14, interval: 0.65 },
      { enemy: 'brute', count: 2, interval: 3, delay: 6 },
    ],
  },
  {
    groups: [
      { enemy: 'runner', count: 14, interval: 0.45 },
      { enemy: 'brute', count: 4, interval: 2.2, delay: 4 },
    ],
  },
  {
    groups: [
      { enemy: 'grunt', count: 20, interval: 0.5 },
      { enemy: 'runner', count: 12, interval: 0.4, delay: 6 },
    ],
  },
  {
    groups: [
      { enemy: 'brute', count: 6, interval: 1.8 },
      { enemy: 'runner', count: 18, interval: 0.35, delay: 5 },
    ],
  },
  {
    groups: [
      { enemy: 'grunt', count: 26, interval: 0.4 },
      { enemy: 'brute', count: 8, interval: 1.5, delay: 4 },
    ],
  },
  {
    groups: [
      { enemy: 'runner', count: 28, interval: 0.28 },
      { enemy: 'brute', count: 10, interval: 1.3, delay: 3 },
    ],
  },
  {
    groups: [
      { enemy: 'grunt', count: 30, interval: 0.35 },
      { enemy: 'runner', count: 22, interval: 0.3, delay: 4 },
      { enemy: 'brute', count: 14, interval: 1.1, delay: 8 },
    ],
  },
];

/** Gold bonus for clearing a wave. */
export const waveClearBonus = (waveNumber: number): number => 20 + 5 * waveNumber;
