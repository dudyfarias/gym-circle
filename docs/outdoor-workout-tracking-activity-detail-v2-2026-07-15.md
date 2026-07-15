# Outdoor Workout Tracking Fix & Activity Detail v2

Data: 15 de julho de 2026
Escopo: app Capacitor iOS (`ios/App`) e experiência web compartilhada. Android e o app SwiftUI paralelo ficaram fora.

## Resumo executivo

A caminhada real de 15/07 comprovou que o detalhe não estava escondendo uma rota válida: a activity foi persistida sem pontos, sem distância e sem tempo em movimento. O pipeline combinava dois riscos: quando o GPS nativo devolvia zero, esse zero substituía o progresso web; ao mesmo tempo, o watcher web era desligado assim que o motor nativo era escolhido. Em ambiente urbano, o filtro nativo de precisão de 50 m também podia rejeitar todas as leituras.

A correção mantém Core Location como motor principal no iOS, passa a manter o watcher web como redundância, combina snapshots por melhor valor monotônico e escolhe a rota mais completa ao finalizar. A rota continua no storage local e no `UserDefaults` nativo durante background/retomada.

O detalhe v2 não inventa métricas: exibe apenas valores positivos e reais; quando existe rota mas a distância persistida está ausente, calcula uma distância apenas para exibição, identificada como derivada, sem alterar o banco. Uma activity sem rota recebe um estado vazio claro, nunca um mapa fictício.

## Evidência da activity real

Consulta read-only em produção, activity `bc336fe3-694a-4758-82d0-3d238bb66b57`:

- tipo: `walk`;
- origem: `web_timer`;
- início: `2026-07-15 13:38:24.788+00` (10:38 em São Paulo);
- final: `2026-07-15 14:18:57.028+00` (11:18 em São Paulo);
- `elapsed_s`: 517 (8:37);
- `moving_s`: 0;
- `distance_m`: 0;
- `route`: 0 pontos;
- calorias e frequência cardíaca: ausentes.

O intervalo de cerca de 40 minutos é incompatível com os 8:37 efetivos. Isso ocorreu no período em que a finalização da caminhada demorava/falhava. O detalhe agora detecta essa inconsistência e mostra apenas o horário de início; não cria um horário final alternativo.

## Pipeline GPS corrigido

1. A sessão nasce com `clientSessionId`, `startedAtMs` e rota local isolada por usuário.
2. No iOS, Core Location usa `kCLLocationAccuracyBestForNavigation`, background location e persistência em `UserDefaults`.
3. O watcher web permanece ativo como redundância enquanto a tela web existe.
4. Leituras com coordenadas inválidas ou precisão acima de 100 m são rejeitadas.
5. Segmentos pequenos acumulam antes de mover a âncora; saltos incompatíveis com caminhada, corrida ou bike são rejeitados.
6. Pausa limpa somente a âncora, preservando a rota anterior e impedindo a ligação artificial durante a pausa.
7. Snapshots nativo e web são combinados por maior distância/tempo/elevação, nunca somados nem substituídos por zero.
8. A finalização aguarda o snapshot final, escolhe a rota válida mais completa e envia o payload idempotente ao Supabase.

## Cálculo de distância

- A captura usa distância geodésica entre leituras consecutivas válidas.
- O banco recebe metros sem arredondamento destrutivo.
- A UI converte para quilômetros apenas na apresentação.
- 0 ou 1 ponto não gera distância nem trajeto.
- No detalhe legado, uma rota com ao menos dois pontos pode gerar distância de exibição; segmentos acima de 2 km são ignorados como saltos e o valor recebe o rótulo `calculado da rota`.
- Esse fallback não atualiza activities automaticamente.

## Tempo e timezone

- `elapsed_s` é a duração efetiva apresentada.
- `moving_s`, quando positivo, é limitado a `elapsed_s` para proteger dados legados inconsistentes.
- O intervalo usa `started_at` e `ended_at` apenas se a diferença for compatível com `elapsed_s`, com tolerância para arredondamento e pequenas pausas.
- Se for incompatível, a UI mostra apenas `Início às HH:mm`.
- Formatação usa o timezone local do dispositivo; há teste explícito para `America/Sao_Paulo`.

## Activity Detail v2

Para caminhada, corrida e bike:

1. hero com mapa e rota quando existem;
2. tipo, data, horário coerente, distância e fonte;
3. grid responsivo de métricas disponíveis;
4. recordes, quando reais;
5. legenda em uma seção `Como foi`;
6. estado `Trajeto indisponível` quando não há pontos suficientes.

Métricas possíveis: duração, tempo em movimento, distância, ritmo médio, elevação, calorias ativas/totais, FC média e máxima. Campos nulos ou zero técnico são omitidos sem deixar buracos.

Atividades de musculação mantêm cabeçalho compacto, séries e recordes. Carga ausente deixa de ser apresentada automaticamente como peso corporal; a tela diferencia `peso do corpo` de `carga não informada`.

## Fonte e privacidade

- Activity `web_timer` aparece como `Registrado pelo Gym Circle`.
- `Apple Watch` só aparece quando `origin=imported` e `source_app` comprova essa fonte.
- Importações sem fonte aparecem como atividade importada.
- O nome pessoal do dispositivo não é repetido no badge Apple Watch.
- Nenhuma coordenada é enviada para analytics e nenhum mapa é criado sem rota real.
- RLS e visibilidade existentes continuam sendo a fonte de autorização.

## Limitações sem HealthKit

A atividade simultânea do Apple Watch não entra automaticamente no treino iniciado pelo Gym Circle. Calorias e frequência cardíaca do relógio só aparecem depois de uma importação HealthKit explícita. Um gráfico de FC exige amostras temporais; `avg_hr` e `max_hr` isolados não são usados para fabricar uma curva.

A ponte read-only de importação Apple Saúde está preparada no mesmo conjunto pendente, mas depende de novo binário iOS/TestFlight. Ela não altera a captura GPS do Gym Circle e não mescla automaticamente dois treinos simultâneos.

## Estados vazios

- duração sem GPS: duração + aviso discreto de trajeto indisponível;
- distância sem rota: distância e ritmo, sem mapa;
- rota sem distância: mapa + distância derivada identificada;
- mapa offline/tiles indisponíveis: polyline sobre fallback visual e aviso do mapa;
- sem calorias/FC/elevação/legenda: seção omitida;
- rota inválida ou com um ponto: tratada como ausente.

## QA físico obrigatório

### Caminhada normal

- [ ] instalar um novo build Capacitor/TestFlight;
- [ ] iniciar e aguardar o primeiro fix;
- [ ] caminhar ao menos 500 m;
- [ ] bloquear a tela e manter o app em background;
- [ ] reabrir e finalizar;
- [ ] confirmar rota, `distance_m`, duração e ritmo;
- [ ] publicar e abrir pelo feed;
- [ ] registrar activity id, quantidade de pontos, `elapsed_s` e `moving_s`.

### Casos adicionais

- [ ] caminhada menor que 2 minutos;
- [ ] permissão negada: continuar apenas com duração e explicar ausência de rota;
- [ ] precisão ruim: buscar sinal sem afirmar rota ativa;
- [ ] pausa, deslocamento e retomada sem contar o salto;
- [ ] corrida;
- [ ] bike;
- [ ] app fechado/reaberto e troca de conta;
- [ ] detalhe offline e fechamento sem bloquear a bottom nav.

## Validação automatizada

Os testes cobrem sanitização de rota, Haversine, distância derivada, rota inválida, distância sem mapa, timezone São Paulo, intervalo inconsistente, `moving_s` legado e origem Apple/Gym Circle. As validações completas do monorepo devem ser registradas na entrega da sprint.

## Antes e depois

Antes: detalhe com um card alto de duração, grande área vazia, legenda misturada ao resumo e intervalo 10:38–11:18 incompatível com 8:37.

Depois: hero outdoor contextual, mapa somente quando real, métricas compactas sem valores falsos, fonte comprovada, legenda separada e horário inconsistente substituído por `Início às 10:38`.

## Próximos passos

1. Gerar um novo build iOS para ativar as mudanças nativas de Core Location e HealthKit.
2. Executar o QA físico acima e consultar a nova activity.
3. Depois de dados reais suficientes, avaliar importação/mesclagem assistida de treinos simultâneos e séries temporais de frequência cardíaca.
