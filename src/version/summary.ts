import { ENEMY_ABILITIES, MAP_SIZES, TOWER_ABILITIES, type Ability, type VersionData } from './format';

/** Plain-language lines describing a version, for the screen shown before anyone plays it. */
export function summarize(v: VersionData): string[] {
  const lines: string[] = [];
  if (v.about) lines.push(v.about);
  const r = v.rules;
  if (r?.gold !== undefined || r?.lives !== undefined) {
    lines.push(`Start with ${r?.gold ?? 150} gold and ${r?.lives ?? 20} lives.`);
  }

  const enemies = v.enemies ?? [];
  if (enemies.length) {
    const list = enemies.map((e) => {
      const name = e.name ?? e.id.toUpperCase();
      const traits = describe(e.abilities, ENEMY_ABILITIES);
      return traits ? `${name} (${traits})` : name;
    });
    lines.push(`${enemies.length} new ${enemies.length === 1 ? 'enemy' : 'enemies'}: ${list.join(', ')}.`);
  }

  if (v.towers?.length) {
    const list = v.towers.map((t) => {
      const name = t.name ?? t.id.toUpperCase();
      const traits = describe(t.abilities, TOWER_ABILITIES);
      return traits ? `${name} (${traits})` : name;
    });
    lines.push(`Your towers: ${list.join(', ')}.`);
  } else lines.push('Your towers: the usual five.');

  if (v.traps?.length) lines.push(`Road traps: ${v.traps.map((t) => t.name ?? t.kind.toUpperCase()).join(', ')}.`);
  lines.push(v.waves?.length ? `${v.waves.length} waves.` : 'The classic 15 waves.');

  const m = v.map;
  if (!m) lines.push('Map: a new random map each game.');
  else if ('rows' in m) {
    const w = Math.max(...m.rows.map((row) => row.length));
    const water = m.rows.some((row) => row.includes('~'));
    lines.push(`Map: drawn by hand, ${w}x${m.rows.length}${water ? ', with water' : ''}.`);
  } else {
    const size = m.size ?? 'small';
    const { cols, rows } = MAP_SIZES[size];
    const river = m.river ? `, with a river and ${m.bridges ?? 2} ${(m.bridges ?? 2) === 1 ? 'bridge' : 'bridges'}` : '';
    lines.push(`Map: random, ${size} (${cols}x${rows})${river}.`);
  }
  return lines;
}

function describe(abilities: Ability[] | undefined, catalogue: Record<string, { describe: (a: Ability) => string }>): string {
  return (abilities ?? [])
    .map((a) => catalogue[a.type]?.describe(a) ?? '')
    .filter(Boolean)
    .join(', ');
}
