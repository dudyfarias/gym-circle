# Gym Circle Modality Taxonomy

The taxonomy is provider-independent and uses stable lowercase IDs. Localized
names are presentation only.

## Categories

| ID | Portuguese | Purpose |
|---|---|---|
| `strength` | Força | Resistance and bodyweight strength |
| `cardio` | Cardio | Continuous cardiovascular activities |
| `sports` | Esportes | Team and individual sports |
| `racket` | Raquete | Racket and paddle sports |
| `water` | Água | Pool and water activities |
| `wellness` | Bem-estar | Body awareness, flexibility and recovery |
| `functional` | Funcional | Circuits and high-intensity mixed work |
| `combat` | Lutas | Boxing and martial arts |
| `outdoor` | Outdoor | Outdoor activities without a mature tracker yet |
| `machines` | Máquinas | Cardio machine sessions |
| `other` | Outros | Explicit fallback |

## Initial catalog

| ID | PT-BR | EN | Category | Current recording |
|---|---|---|---|---|
| `strength` | Musculação | Strength Training | strength | duration, sets, load, rest, RPE, plans |
| `run` | Corrida | Running | cardio | GPS, duration, distance, route, pace |
| `walk` | Caminhada | Walking | cardio | GPS, duration, distance, route |
| `ride` | Bike | Cycling | cardio | GPS, duration, distance, route, speed |
| `pilates` | Pilates | Pilates | wellness | duration, effort |
| `tennis` | Tênis | Tennis | racket | duration, effort |
| `padel` | Padel | Padel | racket | duration, effort |
| `beach-tennis` | Beach Tennis | Beach Tennis | racket | duration, effort |
| `football` | Futebol | Soccer | sports | duration, effort |
| `futsal` | Futsal | Futsal | sports | duration, effort |
| `basketball` | Basquete | Basketball | sports | duration, effort |
| `volleyball` | Vôlei | Volleyball | sports | duration, effort |
| `swimming` | Natação | Swimming | water | duration, optional real distance |
| `cross-training` | Cross Training | Cross Training | functional | duration, effort |
| `crossfit` | CrossFit | CrossFit | functional | duration, effort |
| `functional` | Funcional | Functional Training | functional | duration, effort |
| `hiit` | HIIT | HIIT | functional | duration, effort |
| `yoga` | Yoga | Yoga | wellness | duration, effort |
| `stretching` | Alongamento | Stretching | wellness | duration, effort |
| `mobility` | Mobilidade | Mobility | wellness | duration, effort |
| `calisthenics` | Calistenia | Calisthenics | strength | duration, effort |
| `climbing` | Escalada | Climbing | sports | duration, effort |
| `rowing` | Remo | Rowing | cardio | duration, optional real distance |
| `elliptical` | Elíptico | Elliptical | machines | duration, optional real distance |
| `stair-climber` | Escada | Stair Climber | machines | duration, effort |
| `boxing` | Boxe | Boxing | combat | duration, effort |
| `martial-arts` | Artes Marciais | Martial Arts | combat | duration, effort |
| `dance` | Dança | Dance | wellness | duration, effort |
| `hiking` | Trilha | Hiking | outdoor | duration until native GPS support is reviewed |
| `other` | Outro | Other | other | duration |

## Rules

- Every activity has exactly one canonical modality ID.
- Categories are discovery metadata, not persisted activity identity.
- A capability may be enabled only when capture, persistence and UI are all
  functional.
- Missing measurements remain absent; the catalog never invents them.
- `strength`, `run`, `walk`, `ride` and `other` are permanent compatibility
  IDs.
- New IDs use lowercase ASCII slugs and must include aliases and tests.
- Health providers map into the closest approved catalog ID and retain source
  metadata separately.
- Professional and AI-generated plans reference IDs plus capability
  requirements, never translated labels.
