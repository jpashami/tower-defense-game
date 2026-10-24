import { PALETTE } from '../art/palette';
import { TILE } from '../config/constants';
import { ENEMIES } from '../config/enemies';
import { TOWERS } from '../config/towers';
import { TRAPS } from '../config/traps';
import {
  ENEMY_ABILITIES,
  ENEMY_LOOKS,
  FORMAT,
  FORMAT_VERSION,
  LIMIT,
  MAP_LEGEND,
  MAP_SIZES,
  SHOT_LOOKS,
  TOWER_ABILITIES,
  type AbilitySpec,
  type VersionData,
} from './format';

const COLOUR_NAMES: Record<string, string> = {
  '0': 'near black', '1': 'plum', '2': 'red', '3': 'orange', '4': 'yellow', '5': 'light green', '6': 'green', '7': 'teal',
  '8': 'navy', '9': 'blue', a: 'light blue', b: 'cyan', c: 'white', d: 'light grey', e: 'grey', f: 'dark grey',
  g: 'dark wood', h: 'wood', i: 'sand', j: 'darkest wood', m: 'mid green', n: 'light plum', o: 'pink', z: 'see-through shadow',
};

const range = ([a, b]: readonly [number, number]) => `${a}-${b}`;

function abilityLines(catalogue: Record<string, AbilitySpec>): string {
  return Object.entries(catalogue)
    .map(([type, spec]) => {
      const params = Object.entries(spec.params)
        .map(([k, p]) => (p.enemy ? `"${k}": "<enemy id>"` : `"${k}": ${p.def} (${range(p.range!)}, ${p.doc})`))
        .join(', ');
      const when = spec.trigger === 'none' ? (type === 'shield' ? ' Optional "when".' : '') : ` Default "when": ${JSON.stringify(spec.trigger)}.`;
      return `- "${type}"${params ? ` { ${params} }` : ''}: ${spec.doc}${when}`;
    })
    .join('\n');
}

/**
 * The text a parent pastes into their own Claude chat. It explains the whole format,
 * so Claude can answer with one JSON block the game can read. `current` is the version
 * being changed, if any.
 */
export function buildPrompt(idea: string, current: VersionData | null): string {
  const enemies = Object.values(ENEMIES)
    .map((e) => `${e.key} (hp ${e.hp}, speed ${(e.speed / TILE).toFixed(1)}, reward ${e.reward}, lives ${e.livesCost}${e.armor ? `, armour ${e.armor}` : ''}${e.flying ? ', flying' : ''}${e.boss ? ', boss' : ''})`)
    .join('; ');
  const towers = Object.values(TOWERS)
    .map((t) => {
      const l = t.levels[0];
      return `${t.key} (cost ${t.cost}, damage ${l.damage}, range ${(l.range / TILE).toFixed(1)}, rate ${(1 / l.cooldown).toFixed(1)}${l.splash ? `, splash ${(l.splash / TILE).toFixed(1)}` : ''}${t.hitsAir ? ', hits air' : ''})`;
    })
    .join('; ');
  const palette = Object.keys(PALETTE)
    .map((k) => `${k} ${COLOUR_NAMES[k] ?? ''}`.trim())
    .join(', ');
  const sizes = Object.entries(MAP_SIZES)
    .map(([k, s]) => `${k} ${s.cols}x${s.rows}`)
    .join(', ');
  const legend = Object.entries(MAP_LEGEND)
    .map(([ch, doc]) => `  ${ch}  ${doc}`)
    .join('\n');
  const L = LIMIT;

  return `Please help my family make our own version of the game "Pixel Tower Defence".

OUR IDEA:
${idea.trim() || 'Surprise us with something fun!'}

${current ? `CHANGE THIS VERSION (keep what we didn't ask to change):\n\`\`\`json\n${JSON.stringify(current)}\n\`\`\`\n\n` : ''}Reply with ONE JSON code block (\`\`\`json ... \`\`\`) holding the whole version, then a short, friendly description a child would enjoy. The game only reads plain data: no code, no links, no HTML. Anything it doesn't know is thrown away, and every number is kept inside the limits below. Keep it fair and fun for children; text may use only letters, numbers, spaces and . , ! ? ' - : ( ) &.

THE GAME: enemies walk a road from a portal to the castle; players build towers on grass beside the road and spend gold earned from kills. Each enemy that reaches the castle costs lives. Lengths are in tiles (1 tile = one map square), times in seconds, speeds in tiles per second.

FORMAT (top level; every part is optional except "format", "v" and "name"):
{
  "format": "${FORMAT}", "v": ${FORMAT_VERSION},
  "name": "up to ${L.name} letters", "author": "up to ${L.author}", "about": "up to ${L.about}",
  "theme": { "accent": "#rrggbb", "panel": "#rrggbb" },
  "rules": { "gold": ${range(L.rules.gold)} (start gold, normal 150), "lives": ${range(L.rules.lives)} (normal 20), "growth": ${range(L.rules.growth)} (enemy health +% per wave, normal 17), "speed": ${range(L.rules.speed)} (% enemy speed), "reward": ${range(L.rules.reward)} (% gold per kill), "count": ${range(L.rules.count)} (% enemies per wave) },
  "colors": { "A": "#rrggbb", ... up to ${L.colors} extra drawing colours named by capital letters },
  "enemies": [ up to ${L.enemies} ],
  "towers": [ up to ${L.towers}; if given, these replace the normal towers, so include any normal ones you still want, e.g. { "id": "archer", "base": "archer" } ],
  "traps": [ up to ${L.traps}; towers + traps at most ${L.shop} ],
  "waves": [ up to ${L.waves} ],
  "map": { ... }
}

ENEMY:
{ "id": "ghost" (small letters, digits, _), "base": built-in to copy, "name": up to ${L.enemyName}, "tip": up to ${L.tip} (shown when it first appears),
  "hp": ${range(L.enemy.hp)}, "speed": ${range(L.enemy.speed)}, "reward": ${range(L.enemy.reward)}, "lives": ${range(L.enemy.lives)} (lives lost if it gets through), "size": ${range(L.enemy.size)},
  "color": "#rrggbb" (tints a built-in look; also its puff colour), "look": one of ${ENEMY_LOOKS.join(', ')},
  "sprite": { "frames": [ drawing, drawing ] } (two walking frames; see DRAWINGS),
  "abilities": [ up to ${L.abilities} ] }
Built-in enemies (usable in waves by id, or as "base"): ${enemies}.

ENEMY ABILITIES ({ "type": ..., numbers..., "when": ... }):
${abilityLines(ENEMY_ABILITIES)}
"when" is one of: "spawn", "hit", "death", { "every": seconds }, { "below": percent health }, { "near": tiles to a tower }.

TOWER:
{ "id", "base": built-in to copy, "name": up to ${L.towerName}, "about": up to ${L.towerAbout}, "cost": ${range(L.tower.cost)}, "unlock": wave it unlocks on (0 = from the start),
  "levels": [ 1 to 3 of { "damage": ${range(L.tower.damage)}, "range": ${range(L.tower.range)}, "rate": ${range(L.tower.rate)} shots per second, "splash": ${range(L.tower.splash)} } ],
  "upgrades": [ cost of level 2, cost of level 3 ], "air": true if it can hit flyers, "target": "first" | "strongest" | "closest", "hp": ${range(L.tower.hp)} (only matters if enemies attack towers),
  "shot": one of ${SHOT_LOOKS.join(', ')}, "shot_color": "#rrggbb", "color": "#rrggbb" (tints the look), "look": a built-in tower,
  "sprite": { "base": drawing, "head": drawing facing right (it turns to aim) }, "abilities": [ up to ${L.abilities} ] }
Built-in towers: ${towers}.

TOWER ABILITIES:
${abilityLines(TOWER_ABILITIES)}

ROAD TRAP (placed on road squares, not bridges; flyers and boats pass over; sneaky enemies still set them off):
{ "id", "kind": "bomb" | "spikes" | "tar", "name", "about", "cost": ${range(L.trap.cost)}, "max": ${range(L.trap.max)} on the map at once,
  "damage": ${range(L.trap.damage)}, "radius": ${range(L.trap.radius)} (bomb), "uses": ${range(L.trap.uses)} (spikes), "slow": ${range(L.trap.slow)} (tar: % walking speed), "rearm": ${range(L.trap.rearm)} (bomb: gold to set again) }
Defaults: bomb ${TRAPS.bomb.cost} gold / ${TRAPS.bomb.damage} damage, spikes ${TRAPS.spikes.cost} gold / ${TRAPS.spikes.damage} damage / ${TRAPS.spikes.uses} uses, tar ${TRAPS.tar.cost} gold / ${Math.round(TRAPS.tar.slow * 100)}% speed.

WAVE: { "groups": [ up to ${L.groups} of { "enemy": id, "count": ${range(L.group.count)}, "gap": ${range(L.group.gap)} seconds between them, "wait": ${range(L.group.wait)} seconds before the first } ] } (at most 200 enemies a wave). Make waves get harder; introduce new enemies a few at a time; 8 to 15 waves is a good game.

MAP, either random:
{ "size": ${sizes}, "river": true/false, "bridges": ${range(L.random.bridges)}, "shortcut": true/false, "trees": ${range(L.random.trees)} }
or drawn by hand as rows of characters (${L.map.minCols}-${L.map.maxCols} wide, ${L.map.minRows}-${L.map.maxRows} tall, all rows the same length):
{ "rows": [ "P####....", ... ] }
${legend}
Walkers follow the road (# : I L = and P C) from each portal to the castle by the shortest way, so make one clear road with no gaps; they can only cross water on bridges. Boats sail from R along water (~ = R D) to D. Leave plenty of grass beside the road for towers. If any enemy is a boat, the map needs R joined by water to D (or, for random maps, "river": true).

DRAWINGS: a list of text rows, ${L.sprite.min} to ${L.sprite.max} characters wide and tall, all rows the same length, "." for see-through. 16x16 drawings are shown twice as big; 32x32 fill one map square. Draw enemies facing right with a 1-pixel dark ("0") outline so they stand out on grass. Colours:
${palette}, plus your own "colors" letters.

Before answering, check: valid JSON, every wave enemy exists, every "into" names an enemy, map rows equal length with one C and a joined road.`;
}
