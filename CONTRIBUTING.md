# Helping make Pixel Tower Defence

Pixel Tower Defence is free, forever, for every family. This page explains how anyone can ask for something new, how an idea becomes a clear plan, and how volunteers build it. You don't need to be a programmer for most of it.

## First: does it need a code change at all?

Most "can we have…" ideas don't. On the title screen, **MY VERSION** lets your own Claude chat make new enemies, towers, road traps, waves and whole maps (rivers, boats, sand, ice, lava) in a few minutes, and share them as a link. See "For families: make your own version with Claude" in the [README](README.md).

Ask for a feature here when a version can't do it: a brand-new kind of ability, a new game mode, a new screen, a new way to play.

## 1. Post your idea

1. Go to [**New idea**](https://github.com/jpashami/tower-defense-game/issues/new?template=feature_request.yml). You need a free GitHub account.
2. Fill in the boxes: your idea in plain words, who it's for, and an example of how it would play. The build-ready prompt box is optional.
3. Tick the box that says the idea is friendly for children.

**Children under 13:** GitHub accounts are for ages 13 and up, so a parent or carer posts the idea for you from their own account. Please never put a child's name, school, photo or other personal details in an idea.

Found something broken? Use the [bug report](https://github.com/jpashami/tower-defense-game/issues/new?template=bug_report.yml) form instead.

## 2. Vote for ideas you like

Open the [list of ideas](https://github.com/jpashami/tower-defense-game/issues?q=is%3Aissue+is%3Aopen+label%3Aidea) and add a 👍 reaction to the ones you'd love to see. Please don't post "+1" comments; reactions are easier to count. The most-wanted ideas are the first to be looked at.

## 3. Turn an idea into a build-ready prompt

A **build-ready prompt** is a clear request that a volunteer can hand straight to Claude Code. Anyone can write one, using their own Claude chat at [claude.ai](https://claude.ai) (Claude accounts are for adults, 18+).

**The easy way:** in the game, press **SUGGEST A FEATURE** on the title screen, type the idea, and press **ASK CLAUDE**. The game copies a message for you. Paste it into a Claude chat, answer any questions Claude asks, then copy Claude's answers into the form.

**By hand:** copy the message below into a Claude chat, put your idea between the `"""` marks, and send it.

```text
I play Pixel Tower Defence, a free pixel-art tower defence game for families (Phaser 3 + TypeScript, open source at https://github.com/jpashami/tower-defense-game). I want to ask for a new feature. Please help me turn my rough idea into a clear request.

My rough idea:
"""
(your idea here)
"""

What the game already has: random and classic maps with a shortcut; five towers (Archer, Cannon, Frost, Lightning, Ballista) with three levels each; enemies with armour, flying, healing and bosses; Meteor and Freeze spells; Easy, Normal and Hard; a level Creator; several players on one device; and family "versions" made with Claude that add new enemies, towers, road traps, waves and maps (with rivers, boats, sand, ice and lava) using a fixed list of abilities. Versions need no code change.

Please:
1. Ask me up to 3 short questions if something important is unclear. Keep them easy for a child to answer.
2. If my idea can already be made as a version (MY VERSION on the title screen), say so kindly and stop there, because that is quicker than waiting for a code change.
3. Otherwise write my request with exactly these headings, in plain words a child and a parent can read:

TITLE: a short name for the idea (under 60 characters)
YOUR IDEA IN PLAIN WORDS: 2 to 4 sentences
WHO IT'S FOR: who would enjoy it and why
EXAMPLE OF HOW IT WOULD PLAY: a short moment in a game with this feature
BUILD-READY PROMPT: a request a volunteer can hand straight to Claude Code. Include: what to add or change, how it should look and feel, where it shows up (title screen, shop, map, a version ability), the numbers to start with (cost, damage, range, timing), what must keep working (old saves, Creator share codes, version share links, phones, playing offline), and a short checklist to test it by playing. Keep game numbers in the config files rather than mixed into the code. Do not invent file names you are not sure of.

Keep everything friendly for young children: no gore, no real-world weapons or violence, no rude words, and no names or personal details.
```

You can also add a build-ready prompt to someone else's idea later, as a comment.

## 4. The owner decides

The game's owner reads the ideas, talks about them in the comments, and decides which ones go into the game. Some ideas won't fit, and that's fine: they can still live in your own copy of the game (see "Make your own copy" in the [README](README.md)).

Ideas move through these labels:

| Label | Meaning |
| --- | --- |
| `idea` | A new idea, waiting to be looked at |
| `needs-prompt` | A good idea that still needs a build-ready prompt |
| `approved` | The owner said yes: ready for someone to build |
| `good-first-build` | Approved and small: a nice first one for a new volunteer |
| `building` | Someone is building it now (see the comments for who) |
| `done` | Built and in the game |

## 5. Build an approved idea (volunteers)

You build with **your own** Claude Code and your own GitHub account, so it costs the owner nothing. Anything labelled `approved` (or `good-first-build`) is open to anyone.

1. **Say you're on it.** Comment "I'd like to build this" on the idea. The owner adds `building` so two people don't do the same work.
2. **Make your own copy to work in.** On the [game's page](https://github.com/jpashami/tower-defense-game), press **Fork**. (For a pull request you need a fork. A "Use this template" copy is for families who want their own game; see the README.)
3. **Open Claude Code on your fork.** [Claude Code on the web](https://claude.ai/code) works with nothing installed: pick your fork as the repository. On your own computer, run `git clone` on your fork, `npm install`, then `claude`.
4. **Hand Claude the prompt.** Paste the idea's build-ready prompt and add: "Read CLAUDE.md first. Work on a new branch. When you're done, run `npm test` and `npm run build`." Claude reads [CLAUDE.md](CLAUDE.md), which explains how the game is put together and what must keep working.
5. **Play it.** Try the feature yourself with `npm run dev` (or ask Claude Code to). Check it on a phone-sized screen if it touches the screen layout.
6. **Open a pull request.** Ask Claude Code to push the branch and open a pull request to `jpashami/tower-defense-game`, saying "Closes #<idea number>" in the description. Include a screenshot if the change is visible.
7. **The owner reviews.** They may ask for changes; just pass their comments to Claude Code. When it's merged, the website updates by itself within a few minutes.

Good pull requests are small and do one thing. Please don't change `.github/workflows/`, the licence, or the way saves, Creator share codes and version share links work unless the idea is about exactly that.

## Licence and kindness

By sending a pull request you agree that your change is shared under the game's licence, [GPL-3.0-or-later](LICENSE), so the game and every copy of it stays free. Levels and versions shared as codes or links are shared under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

This is a game for children. Be kind in every comment, keep ideas and art friendly for all ages, and never share personal details about a child. The owner may hide or close anything that isn't.
