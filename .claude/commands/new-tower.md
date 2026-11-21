---
description: Add a new tower to the game, described in plain words
argument-hint: what the tower does and looks like
---

The family wants a new tower in their copy of Pixel Tower Defence. Their idea:

$ARGUMENTS

If no idea was given, ask them in one short, friendly question what the tower should do and look like, then carry on.

1. Read CLAUDE.md, then the "New tower" step in README.md "Changing the game", `src/config/family.ts`, `src/config/towers.ts` (the original towers, to compare with) and the tower sprites in `src/art/sprites.ts`.
2. Tell them your plan in 3 or 4 plain sentences a child can follow: its name, what it's good at, how much it costs, and when it unlocks. Pick fair starting numbers by comparing with the towers already there. Ask "Shall I build it?" and wait for a yes.
3. Build it: an entry in `FAMILY_GAME.towers` in `src/config/family.ts` (not in `TOWERS`, which is the original game), and base, head and projectile sprites drawn on the palette grid and registered in `src/art/sprites.ts`. Leave `towerOrder` as `null` unless they want a different shop order. Tell them the original game stays playable: MY VERSION will list ORIGINAL GAME and their game, whose name they can choose (`FAMILY_GAME.name`).
4. Run `npm test` and `npm run build` and fix anything they report. If you can, play a game on the dev server to check it shows in the shop and fires.
5. Tell them how to try it (`npm run dev`, or wait for the website after pushing), and ask before committing. Make one small commit with a plain message. Don't push to `main` until they say so: pushing publishes their game.
