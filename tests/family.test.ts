// A family copy's own game (config/family.ts) sits on top of the original, which stays playable.
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

const { buildFamilyContent, compileVersion, defaultContent, hasFamilyGame, ORIGINAL_CONTENT } = await import('../src/version/compile.ts');
const { FAMILY_GAME } = await import('../src/config/family.ts');
const { TOWERS, TOWER_ORDER } = await import('../src/config/towers.ts');
const { ENEMIES } = await import('../src/config/enemies.ts');
const { WAVES } = await import('../src/config/waves.ts');
const players = await import('../src/profile/players.ts');
const registry = await import('../src/version/registry.ts');
const versions = await import('../src/version/store.ts');

const sample = {
  name: 'SMITH GAME',
  towers: { sling: { ...TOWERS.archer, key: 'sling', name: 'Sling' } },
  towerOrder: null,
  enemies: { snail: { ...ENEMIES.grunt, key: 'snail', name: 'Snail' } },
  waves: [{ groups: [{ enemy: 'snail', count: 3, interval: 1, delay: 0 }] }],
};

describe('the family game layer', () => {
  test('the original game has no family additions', () => {
    assert.equal(hasFamilyGame(), false);
    assert.equal(hasFamilyGame(FAMILY_GAME), false);
    assert.equal(defaultContent().id, 'classic');
    assert.equal(defaultContent(), ORIGINAL_CONTENT);
  });

  test('family additions are added on top of the original', () => {
    assert.equal(hasFamilyGame(sample), true);
    const c = buildFamilyContent(sample);
    assert.equal(c.id, 'family');
    assert.equal(c.name, 'SMITH GAME');
    assert.deepEqual(c.towerOrder, [...TOWER_ORDER, 'sling']);
    for (const k of c.towerOrder) assert.ok(c.towers[k], `tower ${k} exists`);
    for (const w of c.waves) for (const g of w.groups) assert.ok(c.enemies[g.enemy], `enemy ${g.enemy} exists`);
    assert.ok(c.enemies.grunt, 'original enemies are kept');
  });

  test('building a family game leaves the original game untouched', () => {
    buildFamilyContent(sample);
    assert.equal(ORIGINAL_CONTENT.towers.sling, undefined);
    assert.equal(ORIGINAL_CONTENT.enemies.snail, undefined);
    assert.equal(ORIGINAL_CONTENT.waves, WAVES);
    assert.deepEqual(ORIGINAL_CONTENT.towerOrder, [...TOWER_ORDER]);
  });

  test('a chosen shop order keeps only towers that exist', () => {
    const c = buildFamilyContent({ ...sample, towerOrder: ['sling', 'archer', 'nope'] });
    assert.deepEqual(c.towerOrder, ['sling', 'archer']);
  });

  test('null waves means the original waves', () => {
    assert.equal(buildFamilyContent({ ...sample, waves: null }).waves, WAVES);
  });

  test('versions are still built on the original game', () => {
    assert.equal(compileVersion({ format: 'pixel-td-version', v: 1, name: 'X' } as never).towerOrder.length, TOWER_ORDER.length);
  });
});

describe('picking the original game', () => {
  beforeEach(() => {
    store.clear();
    players.initPlayers();
  });

  test('no saved choice plays the default game, as before', () => {
    registry.useSavedVersion();
    assert.equal(registry.activeContent(), defaultContent());
  });

  test('the original-game choice is kept and played', () => {
    versions.setActiveVersionId(versions.ORIGINAL_ID);
    assert.equal(versions.activeVersionId(), 'original');
    registry.useSavedVersion();
    assert.equal(registry.activeContent().id, 'classic');
    assert.equal(registry.isTryingVersion(), false);
  });

  test('useOriginalGame plays the original', () => {
    registry.useOriginalGame();
    assert.equal(registry.activeContent(), ORIGINAL_CONTENT);
  });

  test('replacing a saved version does not switch away from the original game', () => {
    const first = versions.saveVersion({ format: 'pixel-td-version', v: 1, name: 'MINE' } as never);
    assert.ok(first.ok);
    versions.setActiveVersionId(versions.ORIGINAL_ID);
    const second = versions.saveVersion({ format: 'pixel-td-version', v: 1, name: 'MINE', rules: { gold: 200 } } as never, first.ok ? first.id : undefined);
    assert.ok(second.ok);
    assert.equal(versions.activeVersionId(), 'original');
  });
});
