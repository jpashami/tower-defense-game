---
description: Change how something in the game looks (a sprite, colours, the title)
argument-hint: what to change and how it should look
---

The family wants to change how something looks in their copy of Pixel Tower Defence:

$ARGUMENTS

If it isn't clear what to change, ask one short, friendly question, then carry on.

1. Read CLAUDE.md and "Editing the pixel art" in README.md. Find the thing: sprites in `src/art/sprites.ts` and `src/art/eliteSprites.ts`, ground and water in `src/art/terrainSprites.ts`, colours in `src/art/palette.ts`, buttons in `src/ui/Button.ts`, the title screen in `src/scenes/MenuScene.ts`.
2. Say in one or two plain sentences what you'll change. Small looks changes can go ahead; for anything that changes many things at once, ask first.
3. Draw with the existing grid helpers and palette characters. Keep the same texture keys, sizes (32x32 for sprites) and two walk frames for enemies, so nothing else breaks. Keep it friendly for children.
4. If the change is to the archer tower, run `npm run icons` too, because the app icon is drawn from it.
5. Run `npm test` and `npm run build`. If you can, take a screenshot on the dev server to show them.
6. Ask before committing, and don't push to `main` until they say so: pushing publishes their game.
