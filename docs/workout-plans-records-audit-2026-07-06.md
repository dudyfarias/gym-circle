# Auditoria de treinos, planilhas e recordes — 06/07/2026

## Resumo executivo

O fluxo tinha uma base visual boa, mas três falhas reais: acesso às planilhas
escondido num `+` sem rótulo, editor apertado em telas estreitas e ausência de
importação/recordes no nativo. A rodada corrigiu esses pontos e deixou uma base
única para Web/Capacitor e SwiftUI.

Estado após as correções:

- Web: aprovado em viewport de iPhone `393 × 852`, sem overflow horizontal.
- Capacitor: recebe o mesmo fluxo web porque o shell carrega o deploy Vercel.
- SwiftUI: compila para iOS Simulator e agora tem CRUD, importação e recordes.
- Banco: recordes derivados automaticamente de atividades, com RLS e RPCs
  limitados a usuários autenticados.
- OCR: local, sem API paga e sem upload do documento.

## Passo a passo auditado

1. **Entrada Criar → Iniciar treino — saudável.** O hub separa treino,
   postagem e check-in com linguagem clara.
   Evidência: [02-create-hub.png](design-qa/workouts-2026-07-06/02-create-hub.png).

2. **Escolher modalidade — corrigido.** Os cards já eram claros, mas planilhas
   ficavam escondidas num FAB `+`. O controle agora diz “Planilhas e recordes”.
   Evidência: [08-updated-pick.png](design-qa/workouts-2026-07-06/08-updated-pick.png).

3. **Menu de ferramentas — saudável após ajuste.** Importar, abrir, cadastrar e
   recordes estão separados e ordenados por intenção.
   Evidência: [09-updated-menu.png](design-qa/workouts-2026-07-06/09-updated-menu.png).

4. **Cadastro manual — corrigido.** “Séries” e “Reps” eram comprimidos/cortados.
   A grade agora cabe em 393 px, mantém alvos de toque e tem erros de
   salvar/apagar, retry e confirmação antes da exclusão.
   Evidência: [10-updated-editor.png](design-qa/workouts-2026-07-06/10-updated-editor.png).

5. **Importar foto/PDF — implementado e validado.** PDF com texto usa `pdf.js`;
   foto/PDF escaneado usa `Tesseract.js`. A imagem é reduzida antes do OCR,
   páginas são processadas de forma limitada e o resultado sempre abre para
   revisão. O teste real reconheceu Supino `4×10`, Agachamento `3×12` e Remada
   `4×8`.
   Evidência: [12-imported-plan.png](design-qa/workouts-2026-07-06/12-imported-plan.png).

6. **Sessão de musculação — corrigido.** A linha `reps × kg` não vaza mais da
   tela. Encerrar/pausar/fechar ficam visíveis num dock; ao adicionar série, a
   nova linha rola automaticamente para fora da área coberta pelo dock.
   Evidência: [13-sticky-controls.png](design-qa/workouts-2026-07-06/13-sticky-controls.png).

7. **Séries por exercício — saudável após paridade.** Planilhas pré-carregam
   uma linha por série, cada uma com reps e carga independentes. O detalhe do
   treino agrupa por exercício no web e no SwiftUI.

8. **Recordes pessoais — implementado.** Exibe maior carga por exercício,
   melhor 5 km e melhor 10 km, com estado vazio orientando o próximo passo.
   Está acessível na área de treino e no perfil.
   Evidência: [10-records-empty.png](design-qa/workouts-2026-07-06/10-records-empty.png).

9. **Competição com amigos — implementado.** Cada recorde abre ranking do
   usuário e pessoas seguidas/aceitas, respeitando a visibilidade protegida
   pelo banco.

10. **SwiftUI — paridade funcional concluída.** Inclui biblioteca
    Planilhas/Recordes, CRUD, confirmação de exclusão, importador via
    Vision/PDFKit, ranking e preservação do nome do exercício nas séries.
    Build `GymCircleNative` para iOS Simulator aprovado.

## Como os recordes funcionam

- **Força:** melhor carga por nome normalizado do exercício; em empate, mais
  repetições vence.
- **5 km / 10 km:** atividades de corrida elegíveis geram a marca. Quando a
  distância não é praticamente exata, o tempo é projetado pelo ritmo médio e
  aparece como “estimado”.
- **Histórico:** guarda uma tentativa por atividade/métrica. Apagar a atividade
  apaga o resultado correspondente e o próximo melhor passa a ser o recorde.
- **Atualização:** trigger após inserção/edição da atividade; não depende do
  cliente estar aberto.
- **Privacidade:** tabela com RLS; RPCs de leitura são `security invoker`;
  funções internas do trigger não podem ser executadas por `anon` nem
  `authenticated`.

## Limites intencionais

- O limite geral de mídia do app continua em **1 GB**. O importador de
  planilhas tem limite separado de **25 MB** e 12 páginas, porque OCR de um
  documento enorme em WebView é justamente o tipo de operação que provoca
  estouro de memória.
- OCR digitado/impresso é forte; manuscrito, foto torta ou tabela muito
  irregular pode exigir correção na revisão.
- Treinos antigos de força sem o campo `exercise` não podem ser atribuídos
  automaticamente a um exercício e não entram no recorde de carga.
- Hoje, 5 km/10 km acima da distância-alvo usam o ritmo médio. Para calcular o
  trecho mais rápido real dentro de uma corrida maior, a rota precisa guardar
  timestamp por ponto.
- A auditoria visual autenticada foi feita no modo demo. Banco, RLS e trigger
  foram verificados separadamente; o smoke final com conta real e o teste de
  memória em aparelho físico ainda são gates de release.

## Gargalos restantes e solução recomendada

| Prioridade | Gargalo | Solução |
|---|---|---|
| P1 | 5 km/10 km não calculam o melhor segmento de uma corrida maior | Persistir timestamp/precisão em cada ponto e calcular janela deslizante por distância |
| P1 | Nomes equivalentes dividem recordes (`Supino`, `Supino reto`) | Catálogo de exercícios + aliases normalizados, mantendo nome livre como fallback |
| P1 | Ranking pode receber atividade manual incorreta | Selo de origem (GPS/HealthKit/manual) e filtros de ranking verificado |
| P2 | Falta recorde de volume e 1RM estimado | Acrescentar tonelagem e fórmula configurável de 1RM, sempre rotulada como estimativa |
| P2 | OCR pode pressionar memória em aparelho antigo | Telemetria de duração/memória, cancelamento e testes físicos com PDF de 12 páginas |
| P2 | Não há celebração social de novo PR | Evento “novo recorde”, card no feed e notificação opt-in |

## Verificações executadas

- TypeScript sem erros.
- ESLint sem erros/warnings.
- Vitest: **427/427** testes.
- Next.js production build aprovado.
- Playwright: fluxo estreito, importação OCR e ausência de overflow aprovados.
- Xcode `GymCircleNative`: build de iOS Simulator aprovado.
- Supabase: migration aplicada; trigger testado com atividade temporária de
  Supino e limpeza confirmada.
- Advisor de performance: apenas avisos informativos de índices ainda não
  usados; o índice de recordes é novo e ainda não tem tráfego suficiente para
  ser avaliado. O advisor de segurança esteve intermitente, então RLS, grants,
  `security invoker` e bloqueio das funções internas foram auditados por SQL.
