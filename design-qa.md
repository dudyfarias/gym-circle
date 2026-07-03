# Design QA — treino ao vivo

final result: passed

## Referência e comparação

- Referência: captura do Apple Fitness fornecida em 03/07/2026.
- Implementação: viewport móvel de 390 × 844 px, capturado no Chrome local.
- Comparação lado a lado: [Apple Fitness × Gym Circle](docs/design-qa/workout-apple-comparison.png).
- Estados adicionais: [musculação com descanso](docs/design-qa/workout-strength.png) e [corrida com métricas de rota](docs/design-qa/workout-route.png).

## Critérios verificados

- Hierarquia de leitura rápida: modalidade, tempo dominante, métricas e controles.
- Pausar e retomar preservam o tempo ativo e contabilizam o tempo pausado.
- Fechar minimiza a tela sem encerrar; o botão central passa a exibir “Retomar treino”.
- Descanso aparece somente em musculação, inicia em 1:00 e aceita ajustes de −10/+10 segundos.
- Corrida, caminhada e bike exibem distância, ritmo/velocidade e subida calculados por GPS.
- Controles principais têm áreas de toque grandes e rótulos acessíveis.
- Não foram inventados batimentos ou calorias quando o dispositivo não fornece esses dados.

## Resultado visual

A implementação preserva a identidade preto/ciano do Gym Circle e replica da referência a prioridade do tempo, a leitura por blocos de métricas e o conjunto de ações circulares. A tela de musculação adapta o espaço de rota para o timer de descanso, mantendo a mesma linguagem visual.
