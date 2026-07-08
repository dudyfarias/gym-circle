# Workout posts sem foto — auditoria e correção (2026-07-08)

## Diagnóstico

O problema não estava em curtidas/comentários em si. O fluxo de treino sem foto desviava do modelo social:

- treino encerrado sem mídia era salvo em `activities` via `saveActivityEntry`;
- ele aparecia no feed por `get_home_activities`;
- o card era `FeedActivityCard`, não `SocialPostCard`;
- como não existia `post_id`, os fluxos de `post_likes`, `post_comments`, compartilhamento e menu de post não se aplicavam;
- o composer também escondia o textarea de legenda quando não havia `imageUrl`, então o usuário nem tinha um campo claro para descrição.

## Causa raiz

O produto dizia “treino sem foto aparece no feed”, mas a implementação tratava esse conteúdo como uma entrada de atividade, não como post social real.

Além disso, o banco atual exige `posts.image_url` preenchido. Criar post sem mídia exigiria migration e mudança de contrato. A alternativa mais segura foi reaproveitar o contrato existente: quando o treino não tem mídia, o app gera uma capa automática de stats e publica um post normal com `source_activity_id`.

## Arquivos envolvidos

- `apps/web/src/components/gym-circle/screens/PostScreen.tsx`
- `apps/web/src/components/gym-circle/screens/WebWorkoutScreen.tsx`
- `apps/web/src/components/gym-circle/GymCirclePreview.tsx`
- `apps/web/src/components/gym-circle/workout/workoutShareCover.ts`
- `apps/web/src/components/gym-circle/workout/workoutShareCover.test.ts`
- `apps/web/src/components/gym-circle/design-system/SocialPostCard.tsx`
- `apps/web/src/components/gym-circle/design-system/FeedActivityCard.tsx`
- `apps/web/src/components/gym-circle/design-system/WorkoutRouteMap.tsx`
- `apps/web/src/components/gym-circle/social/types.ts`
- `apps/web/src/i18n/locales/pt-BR.json`
- `apps/web/src/i18n/locales/en.json`

## Correção aplicada

1. Treino sem foto agora pode receber legenda no composer.
2. Ao publicar sem mídia, o app gera uma capa automática de treino em canvas.
3. Essa capa é enviada pelo mesmo pipeline de upload de mídia.
4. O app chama o mesmo `publishWorkout` de posts normais, preservando `source_activity_id`.
5. O post resultante entra em `SocialPostCard`, então ganha:
   - curtir/descurtir;
   - comentar;
   - compartilhar por chat;
   - menu de post;
   - edição/apagar se for do autor;
   - detalhes do treino via `source_activity_id`.
6. O mapa real (`WorkoutRouteMap`) foi adicionado ao card social quando o post tem rota.
7. O card legado de atividades antigas (`FeedActivityCard`) também usa mapa real em vez de `RouteSketch`.

## Banco / Supabase

Não houve migration nesta sprint.

Motivo: o schema atual exige `posts.image_url`. A capa automática mantém o contrato existente e evita criar uma alteração de banco para permitir posts sem mídia.

## Privacidade

O mapa aparece apenas para treino que já foi publicado no feed. Esta sprint não altera a regra de consentimento/publicação; apenas melhora a representação social de um treino que o usuário decidiu postar.

## Riscos e mitigação

- **Duplicidade atividade + post:** posts publicados com `source_activity_id` seguem o caminho já existente de treino promovido, que oculta a activity no feed quando vinculada.
- **Quebra de post normal:** posts com foto/vídeo/carrossel continuam usando o mesmo fluxo anterior.
- **Mapa pesado no feed:** o mapa usa tiles OSM sem SDK pesado; renderiza somente quando existe `post.workout.route` ou activity legada com rota.
- **Falha ao gerar capa:** o usuário recebe erro e pode tentar novamente ou adicionar foto manualmente.

## Resultado esperado

- Treino sem foto permite legenda.
- Treino sem foto nasce como post social completo.
- Outros usuários conseguem curtir, comentar e compartilhar.
- Autor pode editar o post e adicionar fotos depois.
- Caminhada/corrida com rota mostra mapa real compacto no feed.
- Detalhe do treino continua abrindo normalmente.
