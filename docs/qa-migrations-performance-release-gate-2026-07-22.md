# QA, migrations, types e performance — release gate

Data: 2026-07-30
Status automatizado: concluído
Status físico: pendente de execução no iPhone/TestFlight

## Migrations reconciliadas

O histórico local e remoto foi comparado por nome e por objeto. Migrations cujo
schema já existia não foram reaplicadas e nenhum `migration repair` foi usado.

Pendências reais aplicadas individualmente:

- `require_gym_location`;
- `revoke_backfill_user_achievements_execute`;
- `workout_catalog_intelligence`;
- `trainer_profiles_foundation`;
- `trainer_workspace_foundation`;
- `performance_rls_and_fk_indexes`.

O catálogo preservou 94 exercícios, todos receberam a versão editorial v2 e
nenhum aprovado ficou sem metadata obrigatória. Os três locais legados sem
coordenada foram preservados pela constraint `NOT VALID`; novos inserts e
updates precisam de coordenadas válidas.

O backfill administrativo de conquistas não é mais executável por `anon` ou
`authenticated`, mas continua disponível para `service_role`. Trainer profile e
workspace estão vazios, com RLS ativa e sem ativação automática da feature.

## Types e build

`packages/core/src/database.types.ts` foi regenerado diretamente do schema de
produção. Os callers de RPC foram alinhados ao contrato gerado: argumentos
opcionais ausentes usam `undefined`, preservando os defaults SQL.

Validações:

- `npm run check:main`: aprovado;
- `npm run lint`: aprovado;
- `npm test -- --run`: aprovado após atualização dos contratos de teste;
- `npm run build`: aprovado;
- `git diff --check`: aprovado.

## Performance

O advisor de performance tinha um `WARN` de `auth.uid()` avaliado por linha na
policy de `post_activities` e sete FKs sem índice. A migration de hardening
preservou a visibilidade, passou a avaliar `(select auth.uid())` uma vez e criou
os sete índices. Depois dela, o advisor ficou sem `WARN` ou `ERROR`; restaram
apenas índices ainda não usados e o aviso informativo de conexões Auth.

O timestamp local do hardening foi reconciliado com a versão remota
`20260722172807`, sem reaplicar SQL e sem usar `migration repair`. A validação
remota de 30 de julho confirmou a policy e os sete índices. Os seis RPCs de
surface críticos continuam presentes, e os quatro desafios mensais de agosto
de 2026 também foram confirmados.

O `pg_stat_statements` acumula dados desde 6 de maio e ainda carrega o histórico
do antigo loop de `get_profile_posts`, portanto os 54 mil calls não representam
uma janela atual. Na Vercel, a janela de sete dias não tem runtime errors; nas
últimas 24 horas foram observadas 806 respostas, todas HTTP 200.

## Integridade recente de atividades

Consulta agregada read-only dos últimos 30 dias:

- 34 atividades;
- zero `ended_at` anterior a `started_at`;
- zero duração negativa ou maior que o intervalo disponível;
- cinco importações Apple Saúde, todas com `external_id`;
- zero `external_id` duplicado por usuário/origem;
- um post já contém três atividades vinculadas.

Esses dados confirmam o pipeline persistido, mas não substituem sensores e
gestos do aparelho físico.

## Gate físico pendente

Executar no build TestFlight atual e registrar o `activity_id` de cada caso:

1. abrir Perfil, foto/My Circle, editar, Home, Treino e Perfil sem freeze;
2. concluir musculação com menos e mais de dois minutos;
3. concluir caminhada, corrida e bike;
4. caminhar ao menos 500 m com tela bloqueada e confirmar rota/distância;
5. pausar, deslocar, retomar e confirmar que o salto não foi contado;
6. importar do Apple Saúde três treinos do mesmo dia e vinculá-los ao mesmo post;
7. fechar/reabrir o app, trocar conta e confirmar ausência de vazamento local;
8. validar pull-to-refresh, stories pelas bordas, carousel de vídeo e safe area.

O gate só pode ser marcado como fisicamente concluído depois desse teste no
aparelho. Não foi inferido nem simulado neste relatório.

### Bloqueio de tela

O acumulador descartava qualquer segmento entregue após 45 segundos. O Core
Location pode agrupar leituras quando o mostrador está bloqueado; o app agora
ordena o batch, aceita trechos plausíveis em até dez minutos e rejeita por
velocidade/precisão em vez de um teto absoluto de distância. Há cobertura
automatizada para batch atrasado e gap desconexo, mas o item 4 continua sendo a
evidência obrigatória antes do release.
