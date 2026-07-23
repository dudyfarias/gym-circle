# Sprint C — Running Workout Import

## Status

Implementada e validada localmente. Não publicada, não commitada e com a
migration de procedência ainda não aplicada.

## Fixture real

A primeira fixture foi transcrita da imagem
`11542b88-80cf-4e1d-89a5-d185559cae60.JPG`, com 1080 × 1077 px e SHA-256
`8af11bd0e067e2995e0c5461141603d53130be65597b64613a3da6252473e8b3`.

A transcrição preserva quebras típicas de OCR, inclusive pace quebrado entre
linhas e URLs divididas. A imagem original não é versionada no repositório; a
fixture textual, o nome, as dimensões e o hash permitem identificar exatamente
a evidência usada sem duplicar mídia pessoal.

## Contrato

O parser recebe texto vindo de imagem, texto colado ou PDF e devolve
`RunningPlanImportDraft`. Toda saída:

- tem `reviewRequired: true`;
- contém o texto original;
- registra confiança, avisos e linhas não interpretadas;
- usa o mesmo `RunningWorkoutPlanDraft` do editor da Sprint B;
- não persiste nada automaticamente.

O texto original existe apenas no estado local da revisão. O banco recebe
somente o plano revisado e metadata limitada: tipo e nome da fonte, SHA-256,
versão do parser, confiança, avisos, links identificados e linhas não
reconhecidas. O payload bruto da imagem/PDF e o texto integral não são
persistidos.

## Parser determinístico v2

O parser:

- normaliza acentos, caixa, espaços e quebras de linha;
- repara substituições comuns de OCR em tokens numéricos (`4OO` → `400`);
- reconhece distância e faixas em metros/quilômetros;
- reconhece duração e faixas em segundos/minutos/horas;
- normaliza pace para segundos por quilômetro;
- reconhece Z1–Z5;
- reconhece repetições por distância ou tempo;
- associa recuperação na mesma linha ou em linha imediatamente posterior;
- preserva toda linha não reconhecida na revisão;
- informa confiança global e por campo/bloco.

Fixtures automatizadas cobrem intervalado, fartlek, longão, treino por tempo,
OCR degradado e a imagem real fornecida.

## Dados reconhecidos na fixture real

1. Aquecimento: caminhada leve de 3–5 minutos.
2. Alongamento dinâmico: 3–4 exercícios, 3 × 10–20 movimentos.
3. Corrida de 4 km em Z1, pace 5:26–6:10/km.
4. Corrida de 3 km em Z2, pace 4:46–5:25/km.
5. Educativo: 3 × 30–40 segundos.
6. Links de referência, mantidos como metadata e nunca acessados pelo parser.

Pace é armazenado canonicamente em segundos por quilômetro, distância em metros
e duração em segundos. A faixa visual da fonte pode vir do mais lento para o
mais rápido; o domínio normaliza para mínimo e máximo numéricos.

## OCR e revisão

Imagem, screenshot e PDF reutilizam a infraestrutura local já existente:

- pré-processamento em canvas;
- Tesseract.js com português e inglês;
- PDF.js para texto nativo e fallback OCR em páginas escaneadas;
- limite de arquivo, páginas e dimensões já existente.

Texto colado usa o mesmo parser e a mesma revisão. A tela mostra o original e o
plano interpretado, destaca baixa confiança, mantém linhas desconhecidas
visíveis e permite adicionar, remover, duplicar e reordenar blocos. O botão
Salvar é a única ação que inicia persistência.

## Persistência e segurança

`20260723194102_running_workout_import_source_metadata.sql` substitui apenas a
função privada de gravação da Sprint B:

- continua usando `auth.uid()` e ownership;
- aceita no client somente `manual`, `text`, `image` e `pdf`;
- limita `source_metadata` a 64 KiB;
- preserva origem e metadata em edições posteriores;
- não concede leitura pública nem altera as políticas owner-only existentes;
- mantém `security definer` com `search_path = ''`.

A migration não foi aplicada. Até sua aprovação, o frontend também não deve ser
publicado, pois o RPC atual de produção fixa `source = manual`.

O histórico remoto confirma a Sprint B (`20260723191546`) como aplicada e a
Sprint C (`20260723194102`) apenas local. O repositório ainda possui divergências
antigas entre migrations locais e remotas; portanto o release gate não pode usar
um `db push` amplo. A aplicação deve ser isolada e revisar previamente o plano
exato, sem `migration repair` por suposição.

## Validação local

- parser + serviço + adaptador: aprovados;
- 92 arquivos / 688 testes: aprovados;
- lint: aprovado;
- TypeScript: aprovado;
- build Next.js: aprovado;
- `git diff --check`: aprovado;
- fixture real: OCR Tesseract executado no Chromium local e saída real
  adicionada como fixture de regressão; quatro blocos válidos reconhecidos;
- execução visual completa no iPhone: pendente de QA físico;
- RLS com duas contas após a nova migration: pendente do release gate.

## Limites desta entrega

- nível e objetivo não existem na imagem e permanecem marcados para revisão;
- links não são verificados;
- nenhum plano é salvo sem confirmação humana.
- HEIC depende do suporte de decodificação do WebView/iOS;
- o OCR não interpreta diagnóstico ou prescrição médica;
- importação automática, execução guiada e IA permanecem fora desta sprint.
