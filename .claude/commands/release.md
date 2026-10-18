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
6. Close the `<branch>` milestone (skip if it doesn't exist). `Closes #N` in pushed commits closes those issues; list what is still open:
   ```
   gh api repos/dusaniuk/penny-duck/milestones --jq '.[] | select(.title=="<branch>") | .number'
   gh issue list --repo dusaniuk/penny-duck --milestone <branch> --state open
   ```
   - If issues remain open, ask the user per issue: close it, or move it to the next version's milestone
   - Then close: `gh api -X PATCH repos/dusaniuk/penny-duck/milestones/<number> -f state=closed`
7. Clean up: `git branch -d <branch>`, and delete the remote branch only if it exists (`git ls-remote --heads origin <branch>` → `git push origin --delete refs/heads/<branch>`)
8. Create the next version branch (bump the minor version, e.g. `v0.7.0` → `v0.8.0`) and its milestone: `gh api repos/dusaniuk/penny-duck/milestones -f title=<next>`
9. Report the release tag, the closed milestone link, and that Railway deploy is triggered
