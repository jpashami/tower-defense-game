// Fixes from the code review of family versions.
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

const { checkVersion } = await import('../src/version/validate.ts');
const { compileVersion } = await import('../src/version/compile.ts');
const { cleanId } = await import('../src/version/text.ts');
const { WaveManager, MAX_WAVE_SPAWNS } = await import('../src/systems/WaveManager.ts');
const players = await import('../src/profile/players.ts');
const versionStore = await import('../src/version/store.ts');
const registry = await import('../src/version/registry.ts');

describe('ids that every JavaScript object already has', () => {
  // Ids are lower-cased, so only built-in names that are already lower case could ever be looked up.
  const builtIn = Object.getOwnPropertyNames(Object.prototype).filter((k) => k === k.toLowerCase());

  test('are never accepted as ids', () => {
    assert.ok(builtIn.includes('constructor'));
    for (const name of [...builtIn, 'Constructor', ' constructor ']) assert.equal(cleanId(name), null, name);
    assert.equal(cleanId('ghost'), 'ghost');
    assert.equal(cleanId('toString'), 'tostring'); // lower-cased, so it names nothing built in
  });

  test('a tower or enemy called "constructor" is left out, and the version still builds', () => {
    const r = checkVersion({
      name: 'X',
      towers: [{ id: 'constructor', levels: [{ damage: 5 }, { damage: 6 }] }, { id: 'archer', base: 'archer' }],
      enemies: [{ id: 'constructor' }, { id: 'tostring' }, { id: 'ghost' }],
      waves: [{ groups: [{ enemy: 'constructor', count: 3 }, { enemy: 'ghost', count: 3 }] }],
    });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.version.towers!.map((t) => t.id), ['archer']);
    assert.deepEqual(r.version.enemies!.map((e) => e.id), ['tostring', 'ghost']);
    assert.deepEqual(r.version.waves![0].groups.map((g) => g.enemy), ['ghost']);
    const c = compileVersion(r.version);
    assert.equal(Number.isFinite(c.enemies.tostring.hp), true);
    assert.equal(Number.isFinite(c.enemies.tostring.speed), true);
  });

  test('base and look names that are built-in object names never reach the engine', () => {
    const r = checkVersion({ enemies: [{ id: 'a', base: 'constructor', look: 'valueOf' }], towers: [{ id: 't', base: 'constructor', look: '__proto__' }] });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.version.enemies![0].base, undefined);
    assert.equal(r.version.towers![0].base, undefined);
    compileVersion(r.version);
  });
});

describe('a broken saved version never stops the game starting', () => {
  beforeEach(() => store.clear());

  test('a saved choice that is broken or missing falls back to the classic game', () => {
    players.initPlayers();
    players.playerSet('versions', JSON.stringify([{ data: { name: 'X', towers: [{ id: 'constructor', levels: [{ damage: 5 }, { damage: 6 }] }] } }]));
    players.playerSet('active-version', 'gone');
    registry.useSavedVersion();
    assert.equal(registry.activeContent().id, 'classic');
  });

  test('setActiveVersion reports failure instead of throwing', () => {
    const unbuildable = { format: 'pixel-td-version', v: 1, name: 'X', enemies: [{ id: 'x', abilities: 5 }] } as never;
    let ok = true;
    assert.doesNotThrow(() => (ok = registry.setActiveVersion(unbuildable)));
    assert.equal(ok, false);
    assert.equal(registry.activeContent().id, 'classic');
  });
});

describe('towers built on a built-in keep its powers when they set their own levels', () => {
  test('Frost keeps its slow, Lightning keeps its chain', () => {
    const r = checkVersion({
      towers: [
        { id: 'ice', base: 'frost', levels: [{ damage: 5, range: 3, rate: 1 }, { damage: 8, range: 3.5, rate: 1.2 }] },
        { id: 'zap', base: 'lightning', levels: [{ damage: 20, range: 3, rate: 1 }] },
      ],
    });
    assert.ok(r.ok);
    if (!r.ok) return;
    const c = compileVersion(r.version);
    assert.ok(c.towers.ice.levels.every((l) => l.slow), 'frost levels keep slow');
    assert.equal(c.towers.ice.levels[0].damage, 5);
    assert.equal(c.towers.ice.levels[0].range, 96);
    assert.ok(c.towers.zap.levels[0].chain, 'lightning keeps chain');
    assert.equal(c.towers.zap.instant, true);
  });
});

describe('traps and the shop', () => {
  test('a trap may not share an id with a built-in tower', () => {
    const r = checkVersion({ traps: [{ id: 'cannon', kind: 'bomb' }, { id: 'boom', kind: 'bomb' }] });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.version.traps!.map((t) => t.id), ['boom']);
  });
});

describe('waves stay a sensible size after every multiplier', () => {
  test(`at most ${MAX_WAVE_SPAWNS} enemies`, () => {
    const waves = new WaveManager([{ groups: [{ enemy: 'grunt', count: 200, interval: 0.1 }, { enemy: 'runner', count: 100, interval: 0.1 }] }], 3.3);
    waves.startNext();
    let spawned = 0;
    waves.update(10_000, () => spawned++);
    assert.ok(spawned <= MAX_WAVE_SPAWNS, `${spawned} spawned`);
    assert.ok(spawned > 200);
  });

  test('normal waves are untouched', () => {
    const waves = new WaveManager([{ groups: [{ enemy: 'grunt', count: 12, interval: 1 }, { enemy: 'runner', count: 7, interval: 1 }] }], 1.1);
    waves.startNext();
    let spawned = 0;
    waves.update(10_000, () => spawned++);
    assert.equal(spawned, 13 + 8);
  });
});

describe('saving never silently replaces a different version', () => {
  beforeEach(() => {
    store.clear();
    players.initPlayers();
  });
  const make = (about: string) => {
    const r = checkVersion({ name: 'Dragon Tower', about });
    assert.ok(r.ok);
    return (r as Extract<typeof r, { ok: true }>).version;
  };

  test('same name, different contents: kept side by side unless the player says replace', () => {
    const first = make('the first one');
    const second = make('a different one');
    assert.ok(versionStore.saveVersion(first).ok);
    assert.equal(versionStore.sameNameVersion(second)?.data.about, 'the first one');
    assert.ok(versionStore.saveVersion(second).ok);
    assert.equal(versionStore.listVersions().length, 2);
    const third = make('a third one');
    const old = versionStore.sameNameVersion(third)!;
    assert.ok(versionStore.saveVersion(third, old.id).ok);
    assert.equal(versionStore.listVersions().length, 2);
    assert.ok(versionStore.listVersions().some((v) => v.data.about === 'a third one'));
  });

  test('saving the identical version again changes nothing', () => {
    const v = make('same');
    versionStore.saveVersion(v);
    versionStore.saveVersion(v);
    assert.equal(versionStore.listVersions().length, 1);
    assert.equal(versionStore.sameNameVersion(v), null);
  });

  test('a version only being tried out is marked as such', () => {
    registry.setActiveVersion(make('try me'), true);
    assert.equal(registry.isTryingVersion(), true);
    registry.useSavedVersion();
    assert.equal(registry.isTryingVersion(), false);
    assert.equal(registry.activeContent().id, 'classic');
  });
});
