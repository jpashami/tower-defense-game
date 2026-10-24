---
description: Bring the latest changes from the original game into this copy
---

Bring the newest version of the original game, `jpashami/tower-defense-game`, into this family's copy, keeping everything they changed.

1. Read CLAUDE.md. Run `git status`; if there are unsaved changes, tell the family and ask whether to commit them first.
2. Add the original as a remote if it isn't there: `git remote add upstream https://github.com/jpashami/tower-defense-game.git`. Then `git fetch upstream`.
3. If this repository *is* `jpashami/tower-defense-game`, stop and say there's nothing to update from.
4. Show in plain words what's new: summarise `git log --oneline HEAD..upstream/main` (skip anything already here). Ask "Shall I bring these in?" and wait for a yes.
5. Make a branch, `git switch -c get-updates`, and merge: `git merge upstream/main`. A copy made with "Use this template" has no shared history with the original, so the first time git says "refusing to merge unrelated histories"; then use `git merge upstream/main --allow-unrelated-histories`.
6. If there are conflicts, keep the family's own towers, enemies, art and numbers, and take the original's fixes and new features around them. Never take changes that would break their Creator codes, version links or saves. If a choice is really theirs, explain it simply and ask.
7. Run `npm install`, `npm test` and `npm run build`, and fix anything they report.
8. Tell them what changed and how to try it. Ask before merging the branch into `main` and before pushing: pushing to `main` publishes their game.
