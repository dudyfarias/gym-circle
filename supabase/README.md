# Gym Circle — Backend Supabase

Backend completo do Gym Circle: schema, RLS, triggers de streak, storage buckets e Realtime.

## Sumário

- [Arquitetura em 30 segundos](#arquitetura-em-30-segundos)
- [Setup do projeto Supabase](#setup-do-projeto-supabase)
- [Aplicar a migration](#aplicar-a-migration)
- [Aplicar o seed](#aplicar-o-seed)
- [Conectar o app web](#conectar-o-app-web)
- [Como o streak funciona](#como-o-streak-funciona)
- [RLS por tabela](#rls-por-tabela)
- [Storage layout](#storage-layout)
- [Próximos passos](#próximos-passos)

## Arquitetura em 30 segundos

```
auth.users  ─┬→ profiles (1:1)
             ├→ user_stats (1:1, cache de streak)
             ├→ user_activity_days (N, fonte da verdade do streak)
             ├→ posts → image_url obrigatória
             ├→ stories (24h, expiram)
             ├→ post_likes / post_comments
             ├→ follows (grafo)
             ├→ checkins (presença na academia)
             └→ user_gyms ─→ gyms
```

Triggers em `posts` e `stories` populam `user_activity_days` e disparam recálculo
de `user_stats`. RLS leitura aberta para o conteúdo social, escrita restrita ao
dono. Funções `SECURITY DEFINER` ficam no schema `private` (não exposto à Data API).

## Setup do projeto Supabase

> A memória aponta para um projeto chamado `minuto-da-oracao` — ESSE NÃO é o
> Gym Circle. Crie um projeto novo.

1. Em [supabase.com/dashboard](https://supabase.com/dashboard), crie um novo
   projeto (recomendado: `gym-circle`, região São Paulo / Virginia).
2. Anote a `Project URL` e a `anon public` key em **Project Settings → API**.
3. (Opcional) Instale a CLI: `brew install supabase/tap/supabase` ou
   `npm i -g supabase`.

## Aplicar a migration

A migration vive em
[`supabase/migrations/20260506184118_gym_circle_backend_core.sql`](migrations/20260506184118_gym_circle_backend_core.sql).
Ela é idempotente: pode rodar mais de uma vez.

### Opção A — Dashboard (mais rápido)

1. **SQL Editor** → cole o conteúdo da migration → **Run**.
2. Verifique em **Database → Tables** que apareceram as 11 tabelas.
3. Verifique em **Storage** que os buckets `posts`, `stories` e `avatars` existem.

### Opção B — Supabase CLI

```bash
cd /caminho/gym-circle
supabase link --project-ref <seu-project-ref>
supabase db push --linked
```

### Opção C — psql direto

```bash
psql "postgresql://postgres.<ref>:<DB_PASSWORD>@<host>:5432/postgres" \
  -f supabase/migrations/20260506184118_gym_circle_backend_core.sql
```

## Seed local

O [`seed.sql`](seed.sql) era usado apenas para desenvolvimento local com usuários
fake. Para produção/beta, a migration
[`20260507141530_remove_seed_fake_users.sql`](migrations/20260507141530_remove_seed_fake_users.sql)
remove todos os usuários `@gymcircle.test` e seus dados sociais por cascade.

```bash
# Use apenas em banco local descartável.
psql "<connection-string>" -f supabase/seed.sql
```

## Conectar o app web

1. Em `apps/web`, copie `.env.local.example` para `.env.local`:
   ```bash
   cp apps/web/.env.local.example apps/web/.env.local
   ```
2. Preencha:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
3. Rode o dev server:
   ```bash
   npm run dev
   ```
4. Abra:
   - `/` — feed de verdade puxado do Supabase com login real
   - `/demo` — demo visual com dados estáticos, sem tocar na base

## Como o streak funciona

Regras (mesmas no SQL e no TS de `packages/core`):

1. **Origem**: Cada `posts` ou `stories` insere uma linha em `user_activity_days`
   via trigger.
2. **Foto obrigatória**: Apenas linhas com `has_photo = true` contam para
   acender o badge.
3. **Um dia conta uma vez**: 5 posts no mesmo dia = 1 dia de streak. (DISTINCT
   `activity_date` no cálculo.)
4. **Âncora**: `current_streak` ancora em `hoje` se houve atividade hoje;
   senão em `ontem`.
5. **Quebra**: Qualquer dia sem atividade quebra a sequência atual, mas o
   `best_streak` permanece.
6. **Cache**: `user_stats` é atualizado pelos triggers e lido pelo app em O(1).

Validado por 18 testes em
[`packages/core/src/domain/streak.test.ts`](../packages/core/src/domain/streak.test.ts).

```bash
npm --workspace packages/core run test
```

## RLS por tabela

| Tabela                | SELECT       | INSERT                | UPDATE                | DELETE              |
| --------------------- | ------------ | --------------------- | --------------------- | ------------------- |
| profiles              | público      | self (auth.uid)       | self                  | —                   |
| gyms                  | público      | authenticated         | —                     | —                   |
| user_gyms             | self; academia principal por RPC/view limitada | self | self | self |
| posts                 | público      | self                  | self                  | self                |
| stories               | público (não-expirados ou self) | self    | —                     | self                |
| post_likes            | público      | self                  | —                     | self                |
| post_comments         | público      | self                  | self                  | self                |
| follows               | público      | self (= follower_id)  | —                     | self                |
| checkins              | público      | self                  | —                     | self                |
| user_activity_days    | público      | só via triggers       | —                     | só via triggers     |
| user_stats            | público      | só via triggers       | só via triggers       | —                   |

Funções `SECURITY DEFINER` que escrevem em `user_stats` / `user_activity_days`
estão no schema `private`, não exposto à Data API (recomendação da
skill `supabase`).

## Storage layout

Todos os buckets são **públicos para leitura**. Upload e mutação só pelo dono,
identificado pelo prefixo de path = `auth.uid()`.

```
posts/<user_id>/<arquivo>
stories/<user_id>/<arquivo>
avatars/<user_id>/avatar.<ext>
```

Storage exige `INSERT + SELECT + UPDATE` para upsert funcionar — todas as três
policies estão criadas.

## Próximos passos

O que está pronto:

- [x] Migration completa (11 tabelas, triggers, RLS, storage, Realtime)
- [x] Cleanup de usuários fake do seed para beta/produção
- [x] Services + hooks reutilizáveis em `packages/core`
- [x] SupabaseProvider integrado no layout do Next.js
- [x] Tela `/` com feed real, login e stories
- [x] 18 testes Vitest da lógica de streak

O que ficou para iteração seguinte:

- [ ] PWA manifest + ícones.
- [ ] Auto-expurgo de stories (`pg_cron` ou Edge Function chamando
      `delete from stories where expires_at < now()`).
- [ ] Tipos auto-gerados: `supabase gen types typescript --project-id <ref> --schema public > packages/core/src/database.types.ts`.

## Comandos úteis

```bash
# Tipos auto-gerados (após login no CLI)
supabase gen types typescript --project-id <ref> --schema public \
  > packages/core/src/database.types.ts

# Streak tests
npx vitest run packages/core/src/domain/streak.test.ts

# Aplicar só a migration nova
supabase migration up --linked

# Reset do schema local (se usar Supabase local)
supabase db reset
```
