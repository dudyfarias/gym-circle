# Running Plan Editor — 2026-07-23

## Entrada

Ao selecionar Corrida no catálogo esportivo, a tela abre uma biblioteca própria:

1. `Iniciar corrida livre` preserva o fluxo atual de GPS;
2. `Meus treinos` lista planos estruturados;
3. `Criar treino` abre o editor;
4. tocar no plano abre o preview.

Nenhuma execução guiada é simulada. O preview informa que essa etapa virá em
uma sprint futura.

## Campos do plano

- nome;
- descrição;
- nível;
- objetivo.

Distância e duração estimadas são calculadas pelos blocos; o client não mantém
uma segunda regra manual para esses totais.

## Campos do bloco

- tipo;
- título;
- base do alvo;
- distância;
- duração;
- pace mínimo e máximo;
- zona cardíaca;
- esforço;
- repetições;
- mínimo e máximo de repetições;
- tipo e medida de recuperação;
- instruções.

Distância e duração aceitam valor exato ou uma faixa mínima/máxima. Preencher
uma faixa limpa o valor exato equivalente, evitando persistência ambígua.

A unidade é explícita no label e canônica no payload.

## Ações

- adicionar bloco a partir de preset;
- editar;
- mover para cima/baixo;
- duplicar;
- remover;
- salvar/cancelar;
- editar plano existente;
- duplicar plano;
- excluir com confirmação.

Botões de mover são o fallback móvel previsível para drag and drop. Um drag
instável no iPhone não foi introduzido.

## Presets locais

- aquecimento de 10 min;
- corrida leve de 20 min;
- corrida leve de 5 km;
- 6 × 400 m com 1 min de recuperação;
- tempo run de 20 min;
- longão de 10 km;
- desaquecimento de 5 min;
- caminhada de 3 min;
- educativo de 3 × 30 s.

Presets são blocos, não planos automáticos e não constituem prescrição médica.

## Estimativas

A função compartilhada calcula:

- blocos;
- repetições;
- distância;
- duração;
- duração e distância de recuperação;
- distribuição por tipo;
- quantidade de alvos desconhecidos.

Conversões só ocorrem quando há pace:

- duração + pace pode derivar distância;
- distância + pace pode derivar duração.

O preview mostra `≈` para resultados derivados e nunca inventa valor quando
faltam dados.

## Estados e erros

- loading;
- lista vazia;
- falha de leitura com retry;
- erro de validação;
- erro de persistência;
- confirmação de exclusão;
- biblioteca de corrida livre sem depender da migration.

O hook usa uma chave monotônica de request para ignorar respostas obsoletas e
não depende de arrays/objetos recriados em effects.

## Limitações intencionais

- execução guiada não implementada;
- favorito específico de plano de corrida ainda não exposto;
- nenhum OCR/texto/PDF;
- nenhuma geração por IA;
- nenhum HealthKit/Apple Watch;
- nenhum compartilhamento ou assignment profissional.
