# Running Roadmap — 2026-07-23

| Etapa | Status | Entrega | Dependência |
|---|---|---|---|
| Sports Catalog Foundation | Publicada | Corrida pesquisável e personalizada | Migration de preferências aplicada |
| Running Workout Data Model | Migration aplicada; frontend aguardando QA e publicação | Modelo, editor, CRUD, preview e presets | Migration `20260723191546` |
| Running Guided Execution | Implementada localmente; QA/release gate pendente | Engine, state machine, autoavanço, UI guiada, eventos e resumo | Data Model publicado |
| Running Import | Futura | Texto, imagem e PDF no mesmo draft | Editor e validação canônicos |
| Watch/Health Integration | Futura | Execução e importação autorizadas | Contratos nativos e privacidade |
| Adaptive Running | Futura | Recomendação supervisionada e explicável | Escala, consentimento e resultados |

## Gate da execução guiada

Antes de publicar a execução guiada:

1. validar corrida guiada por duração e distância no iPhone;
2. bloquear/desbloquear e retomar a sessão;
3. confirmar transições, pausa, pulo, retorno e conclusão automática;
4. confirmar activity vinculada ao plano e resumo correto;
5. confirmar zero regressão em corrida livre, caminhada, bike e musculação;
6. decidir, em sprint separada, se resultados históricos por etapa exigem
   `running_sessions` e `running_session_step_results`;
7. somente após aprovação, commitar e publicar.
