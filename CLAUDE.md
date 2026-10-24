# Pixel Tower Defence: notes for Claude Code

A 2D pixel-art tower defence game for families. Phaser 3.90 + TypeScript + Vite, built as an offline web app (PWA) and an Android app (Capacitor). Licensed GPL-3.0-or-later.

The people asking you for changes are often parents and children, not programmers. Explain what you did in plain words, show them how to try it, and ask before anything you can't easily undo.

## How the game is put together

- `src/config/` holds all the game's numbers and tables: towers, enemies, waves, difficulty, spells, the classic map. Most changes are edits here, not in the scenes. Keep new numbers in config files too.
- `src/art/` draws every sprite in code on small grids (`draw.ts` helpers, single-character colours from `palette.ts`). There are no image files for the game's art. Enemies have two walk frames, `<key>_0` and `<key>_1`, registered in `sprites.ts`.
- `src/entities/` (Enemy, Tower, Projectile, Trap), `src/systems/` (map generator, waves, economy, placement, map drawing, camera), `src/scenes/` (Menu, Game, UI, GameOver, Editor = the Creator, Versions, Players, Suggest).
- `src/editor/` is the Creator: its levels share as short codes (`TD1.` / `TD2.`).
- `src/version/` is family versions: JSON made by a family's Claude chat, shared as `#v=1.` links. `format.ts` is the single source of the format and its limits; `validate.ts` is the strict checker; `compile.ts` turns a version into game data.
- `src/profile/players.ts` keeps saves per player, and per copy of the game on a shared github.io site. All saving goes through `playerGet` / `playerSet`; never use `localStorage` directly.
- `README.md` "Changing the game" lists the steps for a new tower, enemy, wave or version ability.

## Rules that keep everyone's games working

- **Creator share codes, version links and saves must keep working.** Never change the meaning of an existing `TD1`/`TD2` code or a `v=1` link; add new things in a way that old codes still load the same. Don't rename save keys. `npm test` checks a lot of this (including that every classic map number gives the same map).
- **Versions are pure data.** Never run, `eval` or load anything named in a version or a link (no URLs, scripts, HTML, images). Show their text only as canvas text or a text box's `.value`, never `innerHTML`. Keep the Content-Security-Policy in `index.html` as strict as it is.
- **Keep it friendly for children**: no gore, real-world weapons or rude words in names, text or art.
- **Never edit `.github/workflows/`.** It publishes the game; a mistake there takes the website down.
- **Don't change `LICENSE`** or remove licence notices. The font's licence is `public/fonts/OFL.txt`.

## Before you push

1. `npm test` and `npm run build` must both pass. Fix anything they report before pushing.
2. If you changed something on screen, run `npm run dev` and try it, including on a narrow phone-sized window.
3. Make small commits that each do one thing, with a plain-words message ("Add a mole enemy that digs under the road").

**Pushing to `main` publishes the game.** GitHub Actions rebuilds the website on every push to `main`, and installed copies update the next time they open online. Check with the family before pushing to `main`; for anything big, work on a branch first.

## Commands

```bash
npm install        # once
npm run dev        # play it at http://localhost:5173
npm test           # tests (no browser needed)
npm run build      # type-check and build into dist/
```

On the dev server, the browser console has `simulateMany({ difficulty: 'normal', strategy: 'smart', games: 8 })` to test balance quickly.

## Family copies

Many people working here have their own copy of the game made with "Use this template". The original is `jpashami/tower-defense-game`. The commands in `.claude/commands/` (`/new-tower`, `/new-enemy`, `/change-look`, `/get-updates`, `/my-share-link`) are written for them. Ideas for the original game go through its feature form (see `CONTRIBUTING.md`).
