# Recomendação pessoal de treino por padrão — 13/07/2026

## Decisão de produto

O Gym Circle passa a sugerir um treino salvo com base no comportamento real do
próprio usuário. A primeira versão é um recomendador determinístico e
explicável, não um modelo opaco treinado com poucos dados.

Isso atende ao caso principal — por exemplo, Push às segundas, Pull às terças e
Legs às quartas — sem fingir uma precisão que a amostra atual ainda não suporta.
O sistema aprende automaticamente à medida que novas activities vinculadas a
`workout_plan_id` são finalizadas.

## Sinais usados

O ranking usa cinco sinais, todos auditáveis:

1. padrão do mesmo dia da semana;
2. sequência histórica depois do último treino;
3. frequência geral de uso do treino;
4. recência, evitando recomendar automaticamente o treino de ontem;
5. favorito escolhido explicitamente pelo usuário.

O resultado inclui score, confiança, motivo principal e evidências. Enquanto o
histórico é pequeno, a confiança permanece baixa e a UI usa linguagem de
sugestão, nunca de prescrição.

## Fallbacks

- sem histórico: favorito primeiro;
- sem favorito: treino atualizado mais recentemente;
- sem treinos salvos: nenhuma recomendação;
- activity sem vínculo, data inválida ou plano apagado: ignorada;
- empates: desempate determinístico, para a interface não oscilar.

## Privacidade e segurança

- o cálculo ocorre no cliente autenticado com histórico do próprio usuário;
- não usa dados de outros usuários;
- não envia dados de saúde para provedor externo;
- não produz recomendação médica nem prescrição de carga;
- não substitui a escolha manual: qualquer modalidade ou treino continua
  acessível.

## Quando evoluir para machine learning treinado

Só vale treinar um modelo quando houver volume e avaliação suficientes. Gate
recomendado:

- ao menos 20–30 sessions vinculadas por usuário ativo;
- taxa de vínculo activity↔plan alta e estável;
- dados de conclusão/load type confiáveis;
- conjunto offline temporal para medir top-1/top-3 e comparar com o baseline;
- fallback determinístico obrigatório;
- explicação e opt-out preservados;
- monitoramento de drift e de sugestões ignoradas.

Até esse gate, um modelo treinado adicionaria complexidade e risco sem evidência
de ganho sobre as regras pessoais explicáveis.

## Métricas para avaliar

- suggestion impression → start rate;
- top-1 aceita e top-3 aceita;
- tempo entre abrir Treinar e iniciar sessão;
- taxa de troca manual após sugestão;
- retenção semanal, sem atribuir causalidade antes de experimento;
- precisão offline por corte temporal.

Nenhuma métrica deve registrar notas, cargas, rotas ou conteúdo privado como
evento analítico.

## Cobertura

`workoutRecommendation.test.ts` cobre padrão semanal, sequência, recência,
favorito, histórico escasso, dados inválidos, desempate determinístico e estado
sem treinos.
