# Gym Circle Claude Code Rules

Use the same working directory as Codex:

`/Users/eduardofariascappia/Documents/Site-de-vendas-oracao/gym-circle`

Rules:

- Always work on branch `main`.
- Do not create or use nested `.claude/worktrees/*` worktrees for product changes.
- Before editing or deploying, run `npm run check:main`.
- Do not deploy production from release, preview, worktree, or feature branches.
- Use `npm run deploy:preview` for normal verification deployments.
- Use `npm run deploy:prod` only when Eduardo explicitly asks to publish production.
- Never commit `.env`, `.p8`, certificates, provisioning profiles, `DEVELOPMENT_TEAM`, service role keys, or local screenshots.

