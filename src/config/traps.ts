/**
 * Road traps: a defence placed on the road itself instead of on grass.
 * Flying enemies and boats pass over them; stealthy enemies still set them off.
 * The default game has none; family versions add them.
 */
export type TrapKind = 'bomb' | 'spikes' | 'tar';

export interface TrapDef {
  key: string;
  kind: TrapKind;
  name: string;
  description: string;
  cost: number;
  /** How many of this trap can be on the map at once. */
  max: number;
  /** Bomb: blast damage. Spikes: damage to each enemy that crosses. */
  damage: number;
  /** Bomb blast radius in pixels. */
  radius: number;
  /** Spikes: enemies hurt before the strip breaks. */
  uses: number;
  /** Tar: speed multiplier while standing in it. */
  slow: number;
  /** Bomb: gold to set it again after it goes off. */
  rearm: number;
  texture: string;
  tint?: number;
}

export const TRAPS: Record<TrapKind, TrapDef> = {
  bomb: {
    key: 'bomb',
    kind: 'bomb',
    name: 'Bomb',
    description: 'Blows up when an enemy steps on it. Pay to set it again.',
    cost: 40,
    max: 4,
    damage: 120,
    radius: 48,
    uses: 1,
    slow: 1,
    rearm: 25,
    texture: 'trap_bomb',
  },
  spikes: {
    key: 'spikes',
    kind: 'spikes',
    name: 'Spikes',
    description: 'Hurts every enemy that walks over it. Breaks after a while.',
    cost: 30,
    max: 6,
    damage: 30,
    radius: 16,
    uses: 20,
    slow: 1,
    rearm: 0,
    texture: 'trap_spikes',
  },
  tar: {
    key: 'tar',
    kind: 'tar',
    name: 'Tar',
    description: 'Sticky road. Enemies wade through it slowly.',
    cost: 35,
    max: 6,
    damage: 0,
    radius: 16,
    uses: 1,
    slow: 0.45,
    rearm: 0,
    texture: 'trap_tar',
  },
};
