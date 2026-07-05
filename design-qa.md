# Design QA — status e calorias do treino

final result: passed

## Evidências

- Fonte visual: `/Users/eduardofariascappia/Downloads/Captura de Tela 2026-07-04 à(s) 11.05.44.png`
- Implementação web/Capacitor: [estado pausado](docs/design-qa/workout-status-calories-web.png)
- Comparação normalizada: [antes × depois](docs/design-qa/workout-status-calories-comparison.png)
- Viewport: 390 × 844 px
- Estado: treino “Outro”, 24 segundos ativos, sessão pausada
- Comparação focada: não foi necessária; tipografia, rótulos e controles estão legíveis na comparação integral.

## Findings

Nenhum P0, P1 ou P2 restante.

- Tipografia: o status mantém caixa-alta e cor semântica no canto superior direito; não há mais repetição abaixo do cronômetro.
- Espaçamento: a remoção do status duplicado recupera espaço vertical e preserva a hierarquia tempo → métricas → controles.
- Cores: amarelo continua reservado ao estado pausado; ciano permanece nos controles primários.
- Imagens e ícones: não há ativos rasterizados nesta superfície; os ícones continuam vindo das bibliotecas do produto.
- Conteúdo: “Status” foi substituído por “Cal. totais”, com “—” quando não existe medição ao vivo.

## Patches desde a rodada anterior

- Status ativo/pausado centralizado em um único ponto no topo.
- Removido o “Pausado” textual abaixo do tempo.
- Terceira métrica alterada de “Status” para “Cal. totais”.
- SwiftUI nativo alinhado ao mesmo mostrador e com pausa/retomada persistente.
- GPS nativo pausa sem apagar o trajeto acumulado.
- Descanso nativo limitado à musculação e ajustável em −10/+10 segundos.

## Verificação

- Web: TypeScript, ESLint e testes de cronômetro aprovados.
- iOS nativo: build Debug para iPhone Simulator aprovado.
- O simulador não estava inicializado; a paridade nativa foi validada por compilação, estrutura e tokens compartilhados, sem captura de runtime nesta rodada.
