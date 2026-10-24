---
description: Add a new enemy to the game, described in plain words
argument-hint: what the enemy does and looks like
---

The family wants a new enemy in their copy of Pixel Tower Defence. Their idea:

$ARGUMENTS

If no idea was given, ask them in one short, friendly question what the enemy should do and look like, then carry on.

1. Read CLAUDE.md, then the "New enemy" step in README.md "Changing the game", `src/config/enemies.ts`, `src/config/waves.ts` and `src/art/eliteSprites.ts`.
2. Tell them your plan in 3 or 4 plain sentences a child can follow: its name, how fast and tough it is, anything special it does, and which waves it appears in. Compare with the enemies already there so it's fair. Ask "Shall I build it?" and wait for a yes.
3. Build it: a drawing with two walk frames (`<key>_0`, `<key>_1`) on the palette grid, registered in `src/art/sprites.ts`, an entry in `ENEMIES`, and its key in a few waves. Keep all numbers in `src/config/`. If it needs a brand-new ability, keep that small and explain it.
4. Run `npm test` and `npm run build` and fix anything they report. On the dev server, `simulateMany({ difficulty: 'normal', strategy: 'smart', games: 8 })` in the browser console shows whether the game is still winnable; tune the numbers if not.
5. Tell them how to try it, and ask before committing. Make one small commit with a plain message. Don't push to `main` until they say so: pushing publishes their game.

Tip for them: if they only want to try an enemy quickly, MY VERSION on the title screen can do many enemies with no code change at all.
