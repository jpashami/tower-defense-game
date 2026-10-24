---
description: Find the web address of this copy of the game, to play and share it
---

Help the family find the address of their own copy of the game.

1. Read the GitHub owner and repository name from `git remote get-url origin`. Their game is at `https://<owner>.github.io/<repository>/` (all lower case for the owner). If the repository is called `<owner>.github.io`, it's just `https://<owner>.github.io/`.
2. If the `gh` command works, check it's really live: `gh api repos/<owner>/<repository>/pages` and `gh run list --workflow deploy-pages.yml --limit 3`. Otherwise explain how to check on GitHub: the repository's **Actions** tab shows a green tick when the last publish worked.
3. If it isn't published, explain the one-time setup in plain steps: on GitHub, open the repository's **Settings > Pages**, set **Source** to **GitHub Actions**, then push to `main` (or run the "Deploy to GitHub Pages" workflow from the Actions tab). The repository has to be public for free GitHub Pages.
4. Tell them:
   - Anyone can play their copy at that address, on a phone too, and add it to the home screen to play offline.
   - Version links made with **SHARE LINK** in their copy open in their copy.
   - Their saves are kept separate from the original game and from any other copy on the same github.io site.
   - Every push to `main` updates the game for everyone within a few minutes.

Don't change any settings yourself; give them the steps.
