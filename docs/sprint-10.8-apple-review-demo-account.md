# Sprint 10.8 — Apple Review Demo Account

App Store Review precisa de credenciais de teste no campo **App Review
Information**. Conta vazia faz o reviewer abrir um app sem nada,
geralmente reprova com "we couldn't fully evaluate the app".

Duas opções pra resolver. **Recomendo opção A pra velocidade.**

---

## Opção A — Criar `applereview` novo (recomendado)

### Passo 1: Signup no app

1. Abra Gym Circle (TestFlight ou local) e faça signup com:
   - **Email**: `review@dudyfarias.com` (ou outro que você controle)
   - **Senha**: gere uma forte (mín 12 chars, mix letras/números/símbolo)
   - **Username**: `applereview`
   - **Display name**: `Apple Review`
2. Complete o onboarding (escolha academia, aceite legal, etc).
3. Saia do app.

### Passo 2: Anote o user_id

No SQL Editor do Supabase Dashboard
([abrir](https://supabase.com/dashboard/project/qajjpjmybmqqwflytcpr/sql/new)):

```sql
SELECT user_id FROM profiles WHERE username = 'applereview';
```

Copia o uuid retornado.

### Passo 3: Rodar o seed

Abra `scripts/seed-apple-review.sql`. Substitua `<USER_ID_AQUI>` pelo
uuid do passo 2 (são **2 ocorrências** no topo). Cole tudo no SQL
Editor e Run. Output final mostra:

```
posts: 6   stories_active: 3   achievements: 5   following: 2   streak: 5
```

Verifique no app abrindo a conta:
- ✅ Feed tem posts seus + de johnny + dudy
- ✅ Stories rolam normalmente
- ✅ Achievement Detail abre com hero animado
- ✅ Monthly Recap mostra mês cheio
- ✅ MyCircle tem calendar com fotos + badges

### Passo 4: App Store Connect

Em **App Review Information**:

| Campo | Valor |
|-------|-------|
| Sign-in required | **Yes** |
| User name | `applereview` ou `review@dudyfarias.com` |
| Password | (a senha do signup) |
| Notes | (copie do bloco abaixo) |

**Notes recomendadas:**

```text
Login: applereview / [SENHA]. Pode também usar email review@dudyfarias.com.

Após login, o app abre direto no feed. Tour rápido:
- Tab "Feed" mostra publicações suas e dos amigos.
- Tap no avatar superior abre Stories.
- Tap em uma foto abre o post detail com comentários e likes.
- Tab "Perfil" (canto inferior direito) mostra MyCircle: streak, calendar
  com fotos, achievements (toque pra ver detalhe), Monthly Recap (toque
  pra compartilhar).
- Tap no botão de câmera abre publicação de novo treino (foto/vídeo,
  academia, tipo, descrição).
- Tap em qualquer username/avatar abre o perfil do outro usuário.
- Para excluir conta: Perfil → Configurações → Excluir conta.

Push notifications: pedir permissão na primeira interação. Achievement
unlock dispara notificação real.

Login: email + senha OU username + senha (ambos funcionam).
```

---

## Opção B — Usar conta existente

Se preferir não criar conta nova, há candidatos ricos em dados:

| Username | Posts | Stories | Followers | Achievements | Email |
|----------|-------|---------|-----------|--------------|-------|
| `johnny` | 27 | 25 | 19 | 14 | johnnymazzei98@gmail.com |
| `dudy` | 23 | 19 | 22 | 7 | dudy.cappia@gmail.com |

Caveats:
- São contas de pessoas reais. Você precisa **resetar senha** no Supabase
  Dashboard → Authentication → Users → reset → set new password.
- Avise a pessoa antes — login dela vai cair quando você resetar.
- Quando review terminar, gere nova senha pra ela retomar.

**Recomendação**: Opção A é mais limpa e separa contexto de review.

---

## FAQ

**Q: O seed dispara push notifications?**
Sim — Sprint 10.7 adicionou trigger automático em `user_achievements
INSERT`. Esse script insere 5 achievements de uma vez. Antes de rodar,
ou pause os triggers temporariamente, ou aceite que vão sair 5 pushes
(se o user já tiver dispositivo iOS registrado em `device_push_tokens`).

Pra pausar triggers durante o seed:

```sql
BEGIN;
ALTER TABLE user_achievements DISABLE TRIGGER user_achievements_after_insert_notify;
-- ... rodar seed ...
ALTER TABLE user_achievements ENABLE TRIGGER user_achievements_after_insert_notify;
COMMIT;
```

**Q: Posso re-rodar o script?**
Sim — todos inserts têm `ON CONFLICT DO NOTHING` ou DO UPDATE seguro.
Idempotente.

**Q: Como zerar a conta depois do review?**

```sql
-- Substitua pelo user_id correto
DELETE FROM posts WHERE user_id = '<ID>'::uuid;
DELETE FROM stories WHERE user_id = '<ID>'::uuid;
DELETE FROM user_achievements WHERE user_id = '<ID>'::uuid;
DELETE FROM follows WHERE follower_id = '<ID>'::uuid OR following_id = '<ID>'::uuid;
```

Ou simplesmente delete a conta via app (Perfil → Configurações → Excluir conta).
