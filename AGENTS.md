# Gym Circle Repository Rules

- Single source of truth for Codex and Claude Code:
  `/Users/eduardofariascappia/Documents/Site-de-vendas-oracao/gym-circle`
- Work from this repository root. Use short-lived feature branches such as
  `feat/android-*`, `feat/ios-*`, or `fix/web-*` when platform isolation is
  useful; `main` remains the only source of production releases.
- Do not create or use nested `.claude/worktrees/*` worktrees for app changes.
- Before editing, confirm the current branch and scope. Run `npm run check:main`
  immediately before any production deployment.
- Do not deploy production from release, preview, worktree, or feature branches.
- Keep platform-specific native files out of commits for another platform.
- Stage files selectively; never use `git add .` or `git add -A`.
- Use `npm run deploy:preview` for normal verification deployments.
- Use `npm run deploy:prod` only when the user explicitly asks to publish production.
- Never commit `.env`, `.p8`, certificates, provisioning profiles, `DEVELOPMENT_TEAM`, service role keys, or local screenshots.
