Release the current version branch to production.

Follow these steps exactly:

1. Detect the current branch name (e.g. `v0.7.0`) — abort if on `main`
2. Show the commits that will be released: `git log --oneline HEAD --not main`
3. Ask the user to confirm before proceeding
4. Run the release flow:
   ```
   git rebase main
   git checkout main
   git merge --ff-only <branch>
   git tag <branch>
   git push origin main --tags
   ```
5. Clean up: delete the version branch locally and on remote
6. Create the next version branch (bump the minor version, e.g. `v0.7.0` → `v0.8.0`)
7. Report the release tag and that Railway deploy is triggered
