---
name: firekeep-release
description: Prepare and publish a Firekeep desktop release to GitHub Releases, including versioning, release notes, Windows installer artifacts, and the auto-update manifest. Use when asked to create, publish, automate, or verify a Firekeep release or app update.
---

# Publicar Firekeep

Use this skill only for a deliberate release. It publishes to the GitHub
repository `vinisilvabariane/desktop_fk`; never use it to test ordinary local
changes.

## Workflow

1. Inspect `git status`, `package.json`, `RELEASE_LOG.md`, and the current
   release tag. Preserve unrelated user changes.
2. Decide the next semantic version with the user when it is not explicit.
   Use `1.0.0` for the first stable release; use a patch version for fixes,
   minor for backwards-compatible features, and major for breaking changes.
3. Update `package.json`, `package-lock.json`, and the current section of
   `RELEASE_LOG.md` before publishing. Remove the beta suffix for stable
   releases.
4. Run `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build`. Stop
   on a failure.
5. Review the final diff and ask for confirmation before any external publish,
   unless the user explicitly authorized publishing in the current request.
6. Commit the release with `release: v<version>`, create tag `v<version>`, and
   push the branch and tag.
7. Require `GH_TOKEN` with GitHub repository release permission, then run:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\skills\firekeep-release\scripts\publish-release.ps1 -Version <version>
   ```

8. Verify the GitHub Release contains the NSIS installer and `latest.yml`.
   These two assets are required for installed apps to discover and download
   the update.

## Safety

- Do not publish from an uncommitted worktree.
- Do not overwrite or delete an existing GitHub Release or tag.
- Do not expose `GH_TOKEN` in commands, logs, commits, or release notes.
- The release update client is Windows/NSIS only. Keep the `latest.yml` asset.

## Recovery

If publishing fails after the Git commit and tag succeed, keep them intact,
report the precise failure, and retry only the publishing command after the
token, network, or GitHub Release issue is resolved.
