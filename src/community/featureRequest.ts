/**
 * "Suggest a feature": where ideas go, and the message that helps a family's own Claude
 * chat turn a rough idea into a request that fits the feature form on GitHub
 * (.github/ISSUE_TEMPLATE/feature_request.yml). CONTRIBUTING.md has a copy of the message.
 */

/** Ideas always go to the original game, also from family copies, so everyone shares them. */
export const UPSTREAM_REPO = 'jpashami/tower-defense-game';
export const FEATURE_FORM_URL = `https://github.com/${UPSTREAM_REPO}/issues/new?template=feature_request.yml`;
export const IDEAS_URL = `https://github.com/${UPSTREAM_REPO}/issues?q=is%3Aissue+label%3Aidea`;
export const IDEA_LENGTH = 600;

/** The message for Claude; the idea is the player's own words, kept plain. */
export function buildSuggestPrompt(idea: string): string {
  const rough = idea.trim() || '(No idea typed yet. Ask me what I would like the game to have, then carry on.)';
  return `I play Pixel Tower Defence, a free pixel-art tower defence game for families (Phaser 3 + TypeScript, open source at https://github.com/${UPSTREAM_REPO}). I want to ask for a new feature. Please help me turn my rough idea into a clear request.

My rough idea:
"""
${rough}
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

Keep everything friendly for young children: no gore, no real-world weapons or violence, no rude words, and no names or personal details.`;
}
