import type { EnemyKey } from '../config/enemies';
import type { WaveDef } from '../config/waves';

interface QueuedSpawn {
  time: number;
  enemy: EnemyKey;
}

/** Turns wave definitions into timed spawns. */
export class WaveManager {
  /** 1-based number of the current (or last finished) wave; 0 before the first. */
  current = 0;
  private readonly waves: WaveDef[];
  private queue: QueuedSpawn[] = [];
  private elapsed = 0;

  constructor(waves: WaveDef[]) {
    this.waves = waves;
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
    this.queue = wave.groups
      .flatMap((g) =>
        Array.from({ length: g.count }, (_, i) => ({ time: (g.delay ?? 0) + i * g.interval, enemy: g.enemy })),
      )
      .sort((a, b) => a.time - b.time);
  }

  update(dt: number, spawn: (enemy: EnemyKey) => void): void {
    if (!this.spawning) return;
    this.elapsed += dt;
    while (this.queue.length > 0 && this.queue[0].time <= this.elapsed) {
      spawn(this.queue.shift()!.enemy);
    }
  }
}
