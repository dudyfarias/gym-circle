# Gym Circle Repository Rules

- Single source of truth for Codex and Claude Code:
  `/Users/eduardofariascappia/Documents/Site-de-vendas-oracao/gym-circle`
- Always work from this repository root on branch `main`.
- Do not create or use nested `.claude/worktrees/*` worktrees for app changes.
- Before editing, run `npm run check:main` or verify `git branch --show-current` returns `main`.
- Do not deploy production from release, preview, worktree, or feature branches.
- Use `npm run deploy:preview` for normal verification deployments.
- Use `npm run deploy:prod` only when the user explicitly asks to publish production.
- Never commit `.env`, `.p8`, certificates, provisioning profiles, `DEVELOPMENT_TEAM`, service role keys, or local screenshots.
