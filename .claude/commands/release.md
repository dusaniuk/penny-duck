Release the current version branch to production.

Follow these steps exactly:

1. Detect the current branch name (e.g. `v0.7.0`) — abort if on `main`
2. Abort if the tag already exists locally or on the remote:
   ```
   git rev-parse -q --verify refs/tags/<branch>
   git ls-remote --tags origin refs/tags/<branch>
   ```
3. Show the commits that will be released: `git log --oneline HEAD --not main`
4. Ask the user to confirm before proceeding
5. Run the release flow:
   ```
   git rebase main
   git checkout main
   git merge --ff-only refs/heads/<branch>
   git tag -m "<branch>" <branch>
   git push origin main refs/tags/<branch>
   ```
   - `tag.gpgsign` is on, so the tag must be annotated: always pass `-m "<branch>"` (a bare `git tag <branch>` fails with "no tag message?")
   - Push only the release tag (`refs/tags/<branch>`), never `--tags` — it publishes every stray local tag
   - The branch and tag share a name, so use `refs/heads/` / `refs/tags/` wherever a ref could be ambiguous
6. Clean up: `git branch -d <branch>`, and delete the remote branch only if it exists (`git ls-remote --heads origin <branch>` → `git push origin --delete refs/heads/<branch>`)
7. Create the next version branch (bump the minor version, e.g. `v0.7.0` → `v0.8.0`)
8. Report the release tag and that the GitHub Actions deploy is triggered (`gh run list --workflow deploy.yml --limit 1`)
