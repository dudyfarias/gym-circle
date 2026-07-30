# Competitive Landscape Roadmap

Data: 2026-07-15
Status: processo contínuo de produto; pesquisa inicial baseada em fontes públicas oficiais.

## 1. Objetivo

Transformar análise competitiva em rotina de decisão, não em lista de features.
O resultado esperado é identificar padrões úteis, riscos e espaços próprios do
Gym Circle: social fitness brasileiro + treino + profissionais + lugares.

## 2. Categorias monitoradas

| Categoria | Produtos principais |
|---|---|
| Musculação/log | Hevy, Strong, Jefit, StrongLifts, HeavySet |
| Adaptativo/IA | Fitbod, Freeletics, Future |
| Corrida/outdoor | Strava, Nike Run Club, Runna, Garmin Connect, Adidas Running |
| Mapas/trilhas | AllTrails, Komoot, Strava, Ride with GPS |
| Nutrição | MyFitnessPal, Yazio, Lifesum, MacroFactor |
| Profissionais | Trainerize, TrueCoach, My PT Hub, Everfit, Hevy Coach |
| Saúde/wearables | Apple Fitness/Health, Health Connect, Samsung Health, Garmin, Fitbit |

## 3. Baseline de posicionamento

### Hevy

Combina registro, progresso e social. A lista oficial inclui valores anteriores,
timer, RPE, PR ao vivo, feed, perfis, compartilhamento de rotinas e produto para
coaches. Aprendizado: rapidez de registro e social podem coexistir, mas o Gym
Circle precisa ganhar em contexto local, profissionais e descoberta esportiva.

Fonte: [Hevy features](https://www.hevyapp.com/features/).

### Strong

Posiciona-se como tracker simples que não atrapalha o treino. Destaca melhores
séries, 1RM, gráficos, Apple Health, export CSV, RPE, timers e compartilhamento.
Aprendizado: qualquer inteligência do Gym Circle deve preservar velocidade e
controle do usuário.

Fonte: [Strong](https://www.strong.app/).

### Fitbod

Personaliza usando objetivo, equipamento, agenda, histórico e recuperação, com
progressive overload e recomendações que mudam ao longo do tempo. Aprendizado:
o contexto estruturado é mais valioso que um prompt genérico; a explicação e a
edição precisam acompanhar a sugestão.

Fonte: [Fitbod](https://fitbod.me/).

### Strava

Transforma GPS em mapa, análise, feed, rotas, clubes, desafios e eventos. Usa
Mapbox/OSM em mapas e combina dados externos com sinais próprios da comunidade.
Aprendizado: cada atividade e lugar pode ser objeto social, mas privacidade e
qualidade do GPS são pré-requisitos.

Fontes: [features](https://support.strava.com/hc/en-us/sections/203773977-Strava-Features),
[clubes e desafios](https://support.strava.com/en-us/collections/19657598-clubs-challenges-and-community),
[mapas](https://support.strava.com/en-us/articles/15402176-about-strava-maps).

### Trainerize e plataformas de profissionais

Monitorar onboarding do profissional, gestão de clientes, assignments,
mensagens, hábitos, pagamentos e relatórios. O Gym Circle não deve começar pelo
dashboard; deve começar por consentimento, workspace, vínculo e versões.

Fonte inicial: [Trainerize features](https://www.trainerize.com/features/).

## 4. Scorecard padrão

Para cada produto e versão:

- proposta de valor e público;
- onboarding e tempo até primeiro valor;
- arquitetura de navegação;
- treino ativo e quantidade de toques;
- catálogo e busca;
- progressão, PRs e gráficos;
- GPS, mapas e privacidade;
- social, clubes e compartilhamento;
- wearables e import/export;
- profissional/aluno e consentimento;
- personalização/IA e explicabilidade;
- monetização free/premium;
- acessibilidade e falhas observáveis;
- reclamações recorrentes;
- oportunidade específica para o Gym Circle.

Pontuar de 1 a 5 com evidência e data. Não usar pontuação sem fonte ou teste.

## 5. Fontes de pesquisa

Prioridade:

1. documentação e páginas oficiais;
2. app instalado e fluxo capturado em conta de teste;
3. App Store e Google Play;
4. help centers e changelogs;
5. reviews e comunidades públicas;
6. entrevistas com usuários do Gym Circle.

Não coletar dados privados, contornar login, copiar assets nem reproduzir texto
proprietário. Reviews são sinais, não fatos universais.

## 6. Cadência

### Mensal

- changelogs dos 8 concorrentes prioritários;
- mudança de preço/free tier;
- top 10 reviews recentes por plataforma;
- novas integrações e recursos de IA;
- síntese de uma página com impacto no roadmap.

### Trimestral

- smoke completo de Hevy, Strong, Fitbod, Strava e uma plataforma de coach;
- atualização do scorecard;
- revisão de diferenciação e paridade;
- decisão explícita: copiar padrão, adaptar, ignorar ou pesquisar.

### Por sprint crítica

Antes de GPS, picker, places, trainer e IA, auditar o fluxo equivalente em dois
produtos, sempre com screenshots atuais e critérios objetivos.

## 7. Backlog de hipóteses

- Registro mais rápido aumenta conclusão sem reduzir qualidade dos dados.
- Detalhe outdoor rico aumenta compartilhamento e retenção.
- Locais/equipamentos tornam o treino sugerido mais relevante no Brasil.
- Profissional verificado aumenta confiança, mas exige consentimento granular.
- Explicação e edição aumentam aceitação de sugestões automáticas.
- Social focado em atividade real gera mais valor que feed genérico.

Cada hipótese precisa de métrica e experimento; não vira feature apenas porque um
concorrente possui.

## 8. Riscos de cópia competitiva

- replicar complexidade premium antes do core funcionar;
- copiar UI/asset protegido;
- adotar IA sem dados confiáveis;
- transformar o produto em soma incoerente de concorrentes;
- ignorar Brasil, kg, conectividade, Android e ecossistema local;
- usar review anedótico como prioridade P0.

## 9. Diferenciação proposta

O Gym Circle deve combinar:

- registro de treino simples;
- atividade outdoor visual e social;
- locais e equipamentos do mundo real;
- profissionais com workspace e consentimento;
- recomendações explicáveis e supervisionadas;
- linguagem, unidades e comunidade brasileiras.

## 10. Entregáveis recorrentes

- `competitive-scorecard.csv` ou tabela equivalente;
- relatório mensal de mudanças;
- gravações/screenshot sets de fluxos auditados;
- backlog de hipóteses com owner e métrica;
- ADR quando uma prática competitiva alterar arquitetura.

## 11. Próxima ação

Criar o baseline de cinco produtos: Hevy, Strong, Fitbod, Strava e Trainerize.
Responsáveis: Product Manager + Product Designer. Prazo sugerido: uma semana,
sem interromper o QA outdoor.
