import type { WaveDef } from '../config/waves';

interface QueuedSpawn {
  time: number;
  enemy: string;
}

/** Most enemies one wave may send, after every multiplier. */
export const MAX_WAVE_SPAWNS = 250;

/** Turns wave definitions into timed spawns. */
export class WaveManager {
  /** 1-based number of the current (or last finished) wave; 0 before the first. */
  current = 0;
  private readonly waves: WaveDef[];
  private readonly countMult: number;
  private queue: QueuedSpawn[] = [];
  private elapsed = 0;

  /** countMult scales each group's size and squeezes its spacing to match. */
  constructor(waves: WaveDef[], countMult = 1) {
    this.waves = waves;
    this.countMult = countMult;
  }

  get total(): number {
    return this.waves.length;
  }

  get hasNext(): boolean {
    return this.current < this.waves.length;
  }

  /** True while the current wave still has enemies left to spawn. */
  get spawning(): boolean {
    return this.queue.length > 0;
  }

  startNext(): void {
    if (!this.hasNext) return;
    const wave = this.waves[this.current];
    this.current++;
    this.elapsed = 0;
    const wanted = wave.groups.reduce((n, g) => n + Math.max(1, Math.round(g.count * this.countMult)), 0);
    const shrink = Math.min(1, MAX_WAVE_SPAWNS / wanted);
    this.queue = wave.groups
      .flatMap((g) => {
        const count = Math.max(1, Math.floor(Math.max(1, Math.round(g.count * this.countMult)) * shrink));
        const interval = g.interval / this.countMult;
        return Array.from({ length: count }, (_, i) => ({ time: (g.delay ?? 0) + i * interval, enemy: g.enemy }));
      })
      .sort((a, b) => a.time - b.time);
  }

  update(dt: number, spawn: (enemy: string) => void): void {
    if (!this.spawning) return;
    this.elapsed += dt;
    while (this.queue.length > 0 && this.queue[0].time <= this.elapsed) {
      spawn(this.queue.shift()!.enemy);
    }
  }
}
