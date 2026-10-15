export type EnemyKey = 'grunt' | 'runner' | 'brute';

export interface EnemyDef {
  key: EnemyKey;
  name: string;
  texture: string;
  /** Hit points on wave 1; later waves multiply this. */
  hp: number;
  /** Pixels per second. */
  speed: number;
  /** Gold paid when killed. */
  reward: number;
  /** Lives lost if it reaches the castle. */
  livesCost: number;
  /** Palette colour for its death puff. */
  color: number;
}

export const ENEMIES: Record<EnemyKey, EnemyDef> = {
  grunt: {
    key: 'grunt',
    name: 'Grunt',
    texture: 'enemy_grunt',
    hp: 40,
    speed: 50,
    reward: 5,
    livesCost: 1,
    color: 0x38b764,
  },
  runner: {
    key: 'runner',
    name: 'Runner',
    texture: 'enemy_runner',
    hp: 22,
    speed: 95,
    reward: 4,
    livesCost: 1,
    color: 0xb13e53,
  },
  brute: {
    key: 'brute',
    name: 'Brute',
    texture: 'enemy_brute',
    hp: 180,
    speed: 32,
    reward: 15,
    livesCost: 3,
    color: 0x5d275d,
  },
};
