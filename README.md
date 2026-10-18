# Pixel Tower Defence

A 2D pixel-art tower defence game built with [Phaser 3](https://phaser.io), TypeScript and Vite.
Hold the castle against 10 waves of enemies by building and upgrading towers along the path.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

To make a shareable build, run `npm run build`. The finished game lands in `dist/`, which you can host on any static web host (GitHub Pages, Netlify, itch.io).

## How to play

Pick a difficulty on the title screen with the buttons or the left and right arrow keys. The game remembers your choice.

| Level | Lives | Starting gold | Enemies |
| --- | --- | --- | --- |
| Easy | 30 | 200 | Weaker, and pay 20% more gold |
| Normal | 20 | 150 | The intended challenge |
| Hard | 10 | 125 | 20% faster, 15% more of them, much tougher each wave, and pay 20% less gold |

- Pick a tower in the shop on the right, then click a grass tile to build it. Shift-click builds several.
- Click a built tower to see its range, upgrade it, or sell it for 70% of what you spent.
- Press **Start Wave** when you are ready. After each wave a 12-second countdown starts the next one; starting early pays a small gold bonus.
- Each enemy that reaches the castle costs lives. Lose them all and the game is over. Survive wave 10 to win.

| Key | Action |
| --- | --- |
| 1, 2, 3 | Pick Archer, Cannon, Frost |
| U | Upgrade selected tower |
| S | Sell selected tower |
| Space | Start next wave |
| F | Toggle 1x / 2x speed |
| P | Pause |
| Esc / right-click | Cancel |

## Towers and enemies

| Tower | Cost | Role |
| --- | --- | --- |
| Archer | 50 | Fast single-target shots |
| Cannon | 90 | Slow shells with splash damage |
| Frost | 60 | Slows enemies; upgraded version chills an area |

| Enemy | Trait |
| --- | --- |
| Grunt | Average speed and health |
| Runner | Fast but fragile |
| Brute | Slow and tough; costs 3 lives if it gets through |

## Project layout

```
src/
  main.ts              Phaser game config
  config/              All tunable game data (edit these to change the game)
    constants.ts       Tile size, sell refund, timings
    difficulty.ts      Easy / Normal / Hard settings
    map.ts             Enemy path corners and decorations
    towers.ts          Tower stats, costs and upgrade levels
    enemies.ts         Enemy stats
    waves.ts           Wave composition and clear bonus
  art/                 Pixel art drawn in code from shapes, no image files
  entities/            Enemy, Tower, Projectile
  systems/             Wave spawning, economy, map drawing, placement, effects
  scenes/              Boot, Menu, Game, UI (HUD), GameOver
  ui/Button.ts         Pixel-style button
```

## Changing the game

Everything is table-driven, so most changes are edits to files in `src/config`.

- **Balance**: change numbers in `towers.ts`, `enemies.ts` or `waves.ts`.
- **Difficulty**: change starting gold, lives, enemy health growth, speed, wave size and kill rewards per level in `difficulty.ts`.
- **New wave**: add an entry to `WAVES` in `waves.ts`. The game picks up the new total automatically.
- **New path**: edit `PATH_TILES` in `map.ts`. Corners must be in a straight horizontal or vertical line from the previous one.
- **New upgrade tier**: add another entry to a tower's `levels` and its cost to `upgradeCosts`.
- **New enemy**: add a drawing function with two walk frames to `art/sprites.ts`, an entry to `ENEMIES`, and use its key in a wave.
- **New tower**: add base, head and projectile sprites, an entry to `TOWERS`, and its key to `TOWER_ORDER`. The shop has room for three, so a fourth needs the HUD layout in `scenes/UIScene.ts` adjusted.

### Editing the pixel art

Each sprite in `src/art/sprites.ts` is a small function that draws on a 32x32 pixel canvas using shapes such as discs, rectangles and lines, then adds a dark outline. The canvas helper lives in `src/art/draw.ts`, and colours are single characters from `src/art/palette.ts`. Enemies have two walk frames named `<key>_0` and `<key>_1`. To use real image files instead, load them in `BootScene` with the same texture keys.
