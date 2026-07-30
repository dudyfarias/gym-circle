# Guided Running Experience

Data: 2026-07-24
Status: implementada localmente; QA físico e publicação pendentes

## Fluxo

1. O usuário abre Corrida no catálogo.
2. Pode iniciar corrida livre ou abrir um plano salvo.
3. O preview mostra duração, distância, intensidade e timeline.
4. “Começar treino guiado” cria um snapshot imutável do plano.
5. A tela ativa observa o engine e o pipeline GPS já existente.
6. Duração ou distância atingida avança a etapa automaticamente.
7. O usuário pode pausar, retomar, avançar, pular, voltar ou encerrar.
8. A última etapa finaliza a activity e abre o resumo pós-treino.

## Hierarquia visual

A tela guiada prioriza:

- nome do plano;
- etapa e repetição atual;
- distância ou tempo restante;
- progresso da etapa e total;
- pace atual e pace alvo;
- feedback de ritmo;
- zona cardíaca prescrita, quando houver;
- próxima etapa;
- controles manuais.

A navegação de rodapé existente mantém pausa/retomada e encerramento com
confirmação. Os controles de etapa ficam no card guiado, separados para reduzir
toques acidentais.

## Feedback contextual

As mensagens são determinísticas e disparadas pelo engine:

- início da sessão;
- conclusão do aquecimento;
- entrada no pace alvo;
- última repetição;
- últimos 500 metros;
- conclusão do treino.

Nenhuma mensagem usa IA. A UI recebe somente uma chave de mensagem traduzível.
O mesmo contrato poderá alimentar áudio, haptics ou um coach futuro.

## Falhas e fallback

- Sem GPS: etapas por tempo continuam funcionando e a atividade não é perdida.
- GPS atrasado ou duplicado: a observação não é reaplicada.
- Sem pace: o campo mostra indisponível e nenhum feedback falso é emitido.
- App em background: o estado e o relógio são reconstruídos na retomada.
- Plano vazio ou corrompido: o engine entra em erro e não inicia uma execução
  fictícia.
- Avanço automático indisponível: os botões de concluir/pular continuam como
  fallback.

## Resumo

O pós-treino guiado mostra:

- plano executado;
- etapas concluídas e total;
- pace médio e melhor pace, quando calculáveis;
- tempo correndo;
- tempo em recuperação;
- consistência do pace, quando existirem amostras válidas.

O restante do resumo continua usando a activity canônica: duração, distância,
rota, volume e contexto de compartilhamento.

## QA físico pendente

- corrida por duração com tela bloqueada;
- corrida por distância com GPS nativo;
- intervalo com recuperação;
- pausa durante etapa e durante transição;
- fechar e reabrir o app;
- pular e voltar uma etapa;
- finalizar manualmente;
- concluir automaticamente a última etapa;
- confirmar corrida livre, caminhada, bike e musculação sem regressão.
