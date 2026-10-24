# Pixel Tower Defence

A 2D pixel-art tower defence game built with [Phaser 3](https://phaser.io), TypeScript and Vite.
Hold the castle against 15 waves of enemies on a new random map every game. Mix five kinds of tower, two spells and smart upgrades to stop armoured knights, wolf riders, healers, flying wyverns and the Warlord boss.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

To make a shareable build, run `npm run build`. The finished game lands in `dist/`, which you can host on any static web host (GitHub Pages, Netlify, itch.io).

## Play on a phone, with no internet

The game works with touch and needs no internet once it is on the phone. Everything it needs, including the pixel font, ships with it. It plays in landscape; hold the phone sideways.

On a phone the game fills the whole screen: the map uses the full height and the side panel spreads into the extra width as two larger columns. **Pinch the map with two fingers to zoom in** (up to 2.5x) and drag with one finger to look around; tapping to build works the same while zoomed. On a computer, the mouse wheel zooms. In a phone browser the first tap switches to full screen to hide the address bar (Android and Fire tablets; on iPhones, add the game to the home screen for full screen).

### Option 1: install from a web page (Android and iPhone)

The web build is an installable app (a PWA). Its service worker saves the whole game on the phone the first time it opens.

1. Open **https://jpashami.github.io/tower-defense-game/** on the phone while online and let it load. Every push to `main` rebuilds and republishes this page automatically (`.github/workflows/deploy-pages.yml`), and installed copies update themselves the next time they open online.
2. Wait a few seconds on the title screen so the whole game is saved for offline use.
3. Add it to the home screen. Android Chrome: menu, then **Add to Home screen** (or **Install app**). iPhone Safari: Share, then **Add to Home Screen**.
4. From then on, open it from the home-screen icon. It works in aeroplane mode.

To try the offline build on a computer, run `npm run build` then `npm run preview`.

### Option 2: an Android app (APK)

The `android/` folder is an Android Studio project made with [Capacitor](https://capacitorjs.com). It wraps the same web build in a full-screen, landscape-only app, so nothing is downloaded at run time.

One-time setup: install [Android Studio](https://developer.android.com/studio). It brings the Android SDK and the Java it needs.

Each time you change the game:

```bash
npm run android:sync
```

This builds the game and copies it into `android/`. Then build the APK:

```bash
npm run android:open
```

1. Android Studio opens the project. The first time, let it finish syncing Gradle (bottom status bar); it may offer to download missing SDK parts, so accept.
2. Choose **Build > Build App Bundle(s) / APK(s) > Build APK(s)**.
3. When it finishes, click **locate** in the pop-up. The file is `android/app/build/outputs/apk/debug/app-debug.apk`.

To put it on a phone:

- **With a USB cable (easiest):** on the phone, open **Settings > About phone** and tap **Build number** seven times to unlock Developer options, then turn on **USB debugging** in **Settings > System > Developer options**. Plug the phone in, accept the prompt on the phone, pick it in the device list at the top of Android Studio and press the green **Run** button. The app installs and opens.
- **Without a cable:** copy `app-debug.apk` to the phone (Google Drive, email, USB storage), open it in the phone's Files app, and allow installing from that app when asked.

A debug APK is fine for your own family's phones. Publishing on Google Play needs a signed release build (**Build > Generate Signed App Bundle / APK**) and a Play developer account.

The app icon and splash screen are the game's own archer tower, drawn by `npm run icons` (`scripts/make-icons.mjs`) from the sprites in `src/art/`. Run it again after changing that art, then `npm run android:sync`.

**iPhone app:** a native iOS build (`npx cap add ios`) needs a Mac with Xcode, so it is not set up here. On iPhones, use Option 1.

## How to play

Pick a difficulty on the title screen with the buttons or the left and right arrow keys. The game remembers your choice.

| Level | Lives | Starting gold | Enemies | Shortcut use |
| --- | --- | --- | --- | --- |
| Easy | 25 | 175 | Grow tougher slowly, pay 8% more gold | 25% of enemies |
| Normal | 20 | 150 | A real fight that needs planning | 35% of enemies |
| Hard | 12 | 125 | 10% faster, 10% more of them, pay 10% less gold | 50% of enemies |

### Maps and the shortcut

Every game makes a **new random map**: a winding path from the portal to the castle with trees and rocks scattered around. **NEW MAP** on the title screen rolls another one, and the map number lets you remember a good one. Switch to **CLASSIC MAP** to play the original hand-made map.

Random maps have a **shortcut**: a darker strip of dirt cutting across one bend of the path, blocked by barricades. The barricades break on wave 3, and from then on some enemies take the shorter route, so guard both. Switch it off with **SHORTCUT ON/OFF**. Change the wave it opens on in `src/config/shortcut.ts`, and how many enemies use it in `src/config/difficulty.ts`.

### Playing

- Pick a tower in the shop on the right, then click a grass tile to build it. Shift-click builds several.
- On a touch screen, the first tap on a grass tile shows the tower and its range; tap the same tile again to build it, or tap another tile to move it. **CANCEL** stops placing a tower or aiming the meteor.
- Click a built tower to see its range, upgrade it, or sell it for 70% of what you spent.
- Press **Start Wave** when you are ready. After each wave a 12-second countdown starts the next one; starting early pays a small gold bonus.
- Each enemy that reaches the castle costs lives. Lose them all and the game is over. Survive wave 15 to win.
- When nothing is selected, the panel shows what the **next wave** will send, so you can prepare. New enemy types are introduced with a tip the first time they appear.
- Each tower has a **target** button: **FIRST** (closest to the castle), **STRONG** (most health) or **CLOSE** (nearest the tower).
- **Spells** recharge while a wave is running. **Meteor** crushes ground enemies where you click (on a touch screen, tap to aim, then tap inside the circle to drop it). **Freeze** stops every enemy for 3 seconds (bosses are only slowed).

| Key | Action |
| --- | --- |
| 1 to 8 | Pick a tower or trap from the shop (Archer, Cannon, Frost, Lightning, Ballista in the classic game) |
| U | Upgrade selected tower |
| S | Sell selected tower |
| T | Change selected tower's target |
| R | Repair a broken tower, or set a used bomb again (family versions) |
| Q | Meteor (then click the map) |
| W | Freeze |
| N | New map (title screen) |
| Space | Start next wave |
| F | Toggle 1x / 2x speed |
| P | Pause |
| Esc / right-click | Cancel |

Pause the game to see a button for leaving it.

## Make your own level

Press **CREATE** on the title screen to open the Creator. No typing needed, apart from the level's name.

1. **Paint the path.** With **PATH** picked, click squares one after another, starting on the left edge. Glowing squares show where the path can go next. You can also drag. The last square becomes the castle. **UNDO** takes back the last square, and clicking an earlier square cuts the path short there.
2. **Decorate.** Pick the tree or the rock and click grass to place one; click it again to remove it. **WATER** digs a river: painting the path over water makes a bridge. **ERASE** clears trees, rocks and water. Nobody can build on trees, rocks, water or bridges.
3. **Set up the waves.** **WAVES** opens a panel to choose how many waves there are (1 to 20), how much gold and how many lives you start with, and how many grunts, runners and brutes each wave sends. Click a bar in the chart to pick a wave.
4. **Tune the towers.** **TOWERS** changes each tower's damage, range and cost. Upgrades get better by the same amount.
5. Click the name at the top to rename the level, then press **PLAY** to try it. When the game ends, or from the pause menu, you can go straight back to editing.

**SAVE** keeps up to 6 levels in this browser. **LEVELS** opens or deletes them. The level you're working on is also kept between visits, even if you haven't saved it. **NEW** starts from an empty map or a copy of the classic map.

**SHARE** shows a short code such as `TD1.DRAGON_ROAD.46.L.2R9D8RA.E4R37R.600A01.0BD090QB0I03A0C.FD`. Send it to a friend. They paste it into the same box and press **LOAD CODE**. Levels with water make codes that start with `TD2`; older `TD1` codes still load. Creator levels always play with Normal rules, using the gold and lives you picked.

## For families: make your own version with Claude

Anyone can make their own version of the game and share it as a link, without installing anything or paying for anything. A version mixes three things: **new enemies**, a **new defence army** (towers, plus road traps such as bombs, spikes and tar) and a **new map** (random or drawn by hand, small, medium or large, with rivers, bridges, boats, sand, ice and lava). Your own Claude chat does the creative work.

1. On the title screen, press **MY VERSION**, then **MAKE NEW**.
2. Type your idea, or tap an example such as SPOOKY GHOSTS or PIRATE RIVER.
3. Press **ASK CLAUDE**. The game copies a message that explains the whole version format to Claude. Paste it into a chat at [claude.ai](https://claude.ai) and send it. Claude accounts are for adults, so a parent sends this from their own account.
4. Copy Claude's whole answer, press **PASTE FROM CLAUDE**, paste it in, and press **READ IT**.
5. The game shows a plain-language summary of the version and lists anything it had to leave out. Press **PLAY** to try it, **SAVE** to keep it (it then becomes this player's version on the title screen), or **SHARE LINK**.

To change a version, pick it, then **MAKE NEW** again: Claude gets the current version and changes only what you ask for. **EXAMPLES** has three ready-made versions to try: Ghost Manor (invisible ghosts that split into wisps, and lantern towers that reveal them), River Raid (a hand-drawn river map with bridges and enemy boats) and Giant Kingdom (a large map, tower-smashing trolls, bombs and tar).

### Share links

**SHARE LINK** makes a link like `https://jpashami.github.io/tower-defense-game/#v=1.hZFb...`. The whole version is packed (compressed) into the part after `#`, so nothing is stored on a server and the owner of the site pays nothing. Browsers never send the part after `#` to the web server, so the version stays between the people who share it. Links also work in the installed offline game. Opening one shows the summary first, with **PLAY**, **SAVE** and **NO THANKS**.

Versions you share are offered under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/): anyone may play, change and share them, as long as they say who made them and share their changes the same way. Put your family name in the version's author if you like.

### Players

Tap the player name at the top left of the title screen to switch player, or to add (up to 6), rename or remove one. Each player has their own versions, Creator levels, unsaved Creator draft and settings, so brothers and sisters on one tablet don't overwrite each other. Saves from before players existed belong to PLAYER 1. Removing a player asks twice and deletes everything they saved.

### How the game keeps versions safe

A version is only ever data, never a program. The game:

- reads versions with a strict checker (`src/version/validate.ts`) that builds a fresh copy from the fields it knows, keeps every number inside fixed limits, caps every list, cuts every text to length, and leaves out anything it doesn't recognise, listing it on the summary screen;
- allows only letters, numbers and simple punctuation in names and descriptions, removes web and email addresses, and masks a short list of rude words. Parents still see the summary before anyone plays;
- draws all art itself from small grids of palette colours and loads nothing (no pictures, sounds, links or files) named in a version;
- shows version text only as text drawn on the game canvas or in a text box's value, never as web page code;
- refuses links that are broken, too long, or that would unpack into something huge;
- runs under a Content-Security-Policy (in `index.html`) that only allows the game's own scripts, with no `eval`, and lets the page connect only to its own site.

Saved versions are checked again every time they are loaded. The tests in `tests/` try garbage, enormous numbers, unknown fields, script-like text and booby-trapped links.

### What a version can contain

The full format, with every limit, is in the message ASK CLAUDE copies (built by `src/version/prompt.ts` from `src/version/format.ts`, so it always matches the game). In short:

- **Enemies** (up to 12): health, speed, reward, lives cost, size, colour, a built-in look or a hand-drawn two-frame sprite (up to 32x32), and up to 6 abilities: armour, flying, boat, boss, stealth (hidden unless a revealing tower is near), regeneration, shield, heal aura, slow aura (towers nearby shoot slower), slow-immune, **attack towers** (towers get health, break and need repairing), split, summon, teleport forward, speed burst, explode (damages and stuns towers), cloak and self-heal. Triggered abilities go off on spawn, on hit, on death, every N seconds, below X% health, or near a tower.
- **Towers** (up to 6, replacing the usual five): cost, unlock wave, up to three levels of damage, range, rate and splash, upgrade costs, whether they hit flyers, a shot look, colours or hand-drawn sprites, and abilities: burn, poison, poison cloud, knockback, stun, slow, slow aura, reveal, multi-shot, critical hits, chain lightning and armour-piercing.
- **Road traps** (up to 3, at most 8 shop items in all): bombs (one blast, then pay to rearm), spike strips (hurt each enemy that crosses, break after N uses) and tar (slows). Traps go on road squares only, never bridges; flyers and boats pass over them.
- **Waves** (up to 30) and **rules**: starting gold and lives, how fast enemies toughen, their speed, rewards and numbers. Easy and Hard still work, relative to the version's rules.
- **Map**: random (size, river with 1 to 3 bridges, shortcut, how wooded) or drawn as rows of characters: `.` grass, `#` road, `:` sand (slow), `I` ice (fast), `L` lava (burns), `~` water, `=` bridge, `T` forest, `^` rock, `*` flowers, `P` portal (1 or 2), `C` castle, `R` river start, `D` dock. Walkers cross water only on bridges; boats sail from `R` to `D`; flyers go straight. Medium (26x18) and large (32x22) maps open zoomed out to fit with a minimap in the corner; pinch, scroll or drag to look around, and tap the minimap to jump.

## Ask for a new feature

Some ideas need the game itself to change: a new kind of ability, a new game mode, a new screen. Anyone can ask for one, other families vote for the ones they like, and the owner decides what goes in.

1. On the title screen, press **SUGGEST A FEATURE** and type the idea in your own words.
2. Press **ASK CLAUDE**. The game copies a message for your own Claude chat, which asks a couple of questions and turns the idea into a clear request (or points out when MY VERSION can already do it).
3. Press **OPEN THE FORM** and copy Claude's answers into the [feature request form](https://github.com/jpashami/tower-defense-game/issues/new?template=feature_request.yml) on GitHub. With no internet, the game shows the link to use later.

Claude accounts are for adults (18+) and GitHub accounts for ages 13 and up, so a parent posts ideas for younger children. [CONTRIBUTING.md](CONTRIBUTING.md) explains voting, how ideas become build-ready prompts, and how volunteers build approved ideas with their own Claude Code.

## Make your own copy

Want to change the game itself, not just make a version? Make your own copy, with its own web address, and change anything with your own Claude Code. It costs nothing, and the original game is untouched. You need a GitHub account (13+) and a Claude account (18+), so a parent sets this up.

1. **Copy the game.** Sign in to GitHub, open [jpashami/tower-defense-game](https://github.com/jpashami/tower-defense-game), press **Use this template**, then **Create a new repository**. Give it a name (say `our-tower-game`) and keep it **Public**.
2. **Switch on your website.** In your new repository, open **Settings > Pages** and set **Source** to **GitHub Actions**. Then open the **Actions** tab and run **Deploy to GitHub Pages** (or just make your first change). After a few minutes your game is at `https://<your-github-name>.github.io/our-tower-game/`.
3. **Change it with Claude Code.** Open [Claude Code on the web](https://claude.ai/code) with your own Claude account, connect GitHub, and pick your new repository. Nothing needs installing. Ask in plain words, or use the ready-made commands:
   - `/new-tower a honey tower that makes enemies sticky`
   - `/new-enemy a mole that digs under the road`
   - `/change-look make the castle pink with a flag`
   - `/my-share-link` finds your game's web address and checks it's published
   - `/get-updates` brings in new features and fixes from the original game, keeping your changes

   Claude reads [CLAUDE.md](CLAUDE.md) first, which explains how the game is built and what must keep working. It runs the tests and the build before saving your changes.
4. **Publish.** When Claude pushes a change to `main`, your website rebuilds by itself within a few minutes.

Each copy keeps its own saves, even when several copies live on the same `github.io` site. The first time a copy opens, it brings in any saves already on that site, so nobody loses their levels and versions. Built something everyone would enjoy? [Suggest it](CONTRIBUTING.md) for the original game.

## Towers and enemies

Every tower has three levels. Lightning and Ballista are locked until their wave starts.

| Tower | Cost | Unlocks | Role |
| --- | --- | --- | --- |
| Archer | 50 | Start | Fast single shots. Hits flyers. Weak against armour |
| Cannon | 90 | Start | Splash damage on groups. Ground only |
| Frost | 60 | Start | Slows enemies; higher levels chill an area. Ground only |
| Lightning | 150 | Wave 4 | Bolts jump between up to 6 enemies, flyers included |
| Ballista | 200 | Wave 7 | Very long range, huge damage, pierces armour, hits flyers |

| Enemy | First seen | Trait |
| --- | --- | --- |
| Grunt | Wave 1 | Average speed and health |
| Runner | Wave 2 | Fast but fragile |
| Knight | Wave 3 | Armour removes 8 damage from every hit. Use cannons, ballistas or the meteor |
| Brute | Wave 4 | Slow and tough; costs 3 lives |
| Shaman | Wave 4 | Heals enemies around it. Kill it first |
| Warlord | Waves 5, 10, 15 | Boss: huge health, armour, can't be slowed; costs 6 lives |
| Wyvern | Wave 6 | Flies straight to the castle over everything. Only Archer, Lightning and Ballista can hit it |
| Wolf Rider | Wave 8 | Very fast and tough |

## Project layout

```
src/
  main.ts              Phaser game config
  config/              All tunable game data (edit these to change the game)
    constants.ts       Tile size, sell refund, timings
    difficulty.ts      Easy / Normal / Hard settings
    shortcut.ts        When the shortcut opens
    spells.ts          Meteor and Freeze
    settings.ts        Title-screen choices remembered in the browser
    map.ts             The classic map's path and decorations, path helpers
    towers.ts          Tower stats, costs and upgrade levels
    enemies.ts         Enemy stats
    waves.ts           Wave composition and clear bonus
    level.ts           LevelDef (map, waves, tower tuning) and the built-in level
  editor/              Creator levels: format, validation, share codes, saving
  version/             Family versions: format and limits, checker, compiler, drawn maps,
                       share links, the Claude prompt, summaries, examples, saving
  profile/players.ts   Players on one device and their separate saves (and each copy's own saves)
  community/           Suggest a feature: the form's link and the message for Claude
  dev/autoplay.ts      Test player for balancing (dev server only, see below)
  art/                 Pixel art drawn in code from shapes, no image files
  entities/            Enemy, Tower, Projectile
  systems/             Random map generator, wave spawning, economy, map drawing, placement, effects
  scenes/              Boot, Menu, Game, UI (HUD), GameOver, Editor (the Creator),
                       Versions (make, paste, share), Players, Suggest (ask for a feature)
  ui/Button.ts         Pixel-style button
  ui/touch.ts          Detects phones and tablets for tap hints
public/
  fonts/               Press Start 2P font and its licence (SIL OFL 1.1)
  icons/               Home-screen icons (made by npm run icons)
public/style.css       Page styles (kept out of index.html for the Content-Security-Policy)
scripts/make-icons.mjs Draws the app icons and Android splash from the game's sprites
scripts/ts-hooks.mjs   Lets `npm test` run the TypeScript source directly in Node
tests/                 Tests for versions, links, players and share codes (`npm test`)
android/               Android Studio project (Capacitor), see "Play on a phone"
capacitor.config.ts    Android app id, name and the web folder it wraps
.github/ISSUE_TEMPLATE/ Feature request and bug report forms
CLAUDE.md              How the game is built, for Claude Code (read first)
.claude/commands/      /new-tower, /new-enemy, /change-look, /get-updates, /my-share-link
CONTRIBUTING.md        Asking for features, voting, and building approved ideas
```

## Changing the game

Everything is table-driven, so most changes are edits to files in `src/config`.

- **Balance**: change numbers in `towers.ts`, `enemies.ts` or `waves.ts`.
- **Difficulty**: change starting gold, lives, enemy health growth, speed, wave size and kill rewards per level in `difficulty.ts`.
- **New wave**: add an entry to `WAVES` in `waves.ts`. The game picks up the new total automatically.
- **New path**: edit `PATH_TILES` in `map.ts`. Corners must be in a straight horizontal or vertical line from the previous one.
- **New upgrade tier**: add another entry to a tower's `levels` and its cost to `upgradeCosts`.
- **New enemy**: add a drawing function with two walk frames to `art/eliteSprites.ts`, register it in `art/sprites.ts`, add an entry to `ENEMIES`, and use its key in a wave.
- **New tower**: add base, head and projectile sprites, an entry to `TOWERS`, and its key to `TOWER_ORDER`. With six or more items the shop switches to a grid of up to eight smaller cards.
- **New ability for versions**: add it to the catalogue in `src/version/format.ts` (the checker and the Claude prompt pick it up), turn it into game data in `src/version/compile.ts`, and make it happen in `GameScene` or the entity it belongs to.
- **Creator levels** use only the original three towers and three enemies, so share codes stay short and keep working.

### Editing the pixel art

Each sprite in `src/art/sprites.ts` is a small function that draws on a 32x32 pixel canvas using shapes such as discs, rectangles and lines, then adds a dark outline. The canvas helper lives in `src/art/draw.ts`, and colours are single characters from `src/art/palette.ts`. Enemies have two walk frames named `<key>_0` and `<key>_1`. To use real image files instead, load them in `BootScene` with the same texture keys.

### Testing the balance

On the dev server (`npm run dev`), the browser console has a test player that plays whole games in about a second each, without drawing them:

```js
simulateMany({ difficulty: 'normal', strategy: 'smart', games: 8 })
```

`smart` uses every tower, upgrades and both spells; `medium` sticks to the three basic towers; `naive` only builds archers. Add `version: 'ghost_manor'` (or `river_raid`, `giant_kingdom`) to test an example version, and `playExample('river_raid')` opens one in a normal game. The result shows wins, lives left and which enemies got through. The current numbers were tuned so that on Normal a smart player wins most games with lives to spare, and on Hard only some of the time.

### Tests

```bash
npm test
```

Runs the tests in `tests/` with Node's own test runner (no browser): the version checker against garbage, huge numbers, unknown fields and script-like text, drawn and random maps (including that every classic map number still gives the same map), share links (round trips, broken and oversized links, zip bombs), players' separate saves, and Creator share codes.

## Licence

Pixel Tower Defence is free software: you can play it, copy it, change it and share it, under the [GNU General Public License, version 3 or (at your option) any later version](LICENSE) (GPL-3.0-or-later). Anyone who shares a changed copy must share it under the same licence, with its source code, so the game and every version of it stays free forever.

Copyright (C) 2026 jpashami and contributors.

- **Levels and versions** you share as Creator codes or links are shared under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **The Press Start 2P font** is by The Press Start 2P Project Authors (CodeMan38), under the SIL Open Font License 1.1 (`public/fonts/OFL.txt`).
- **Libraries** the game is built with are under licences that work with the GPL: [Phaser](https://phaser.io) (MIT), [Capacitor](https://capacitorjs.com) (MIT), [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) and Workbox (MIT), [Vite](https://vite.dev) (MIT) and [TypeScript](https://www.typescriptlang.org) (Apache-2.0, a build tool only, not part of the game).
