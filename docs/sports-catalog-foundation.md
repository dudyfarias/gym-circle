# Sports Catalog & Personalization Foundation

Status: implemented; database release gate completed.
Frontend deployment: pending.
Migration: applied before the frontend and validated with two-user RLS checks.

## 1. Audit of the previous state

Modalities were defined as five hardcoded cards in `WebWorkoutScreen.tsx`:
`strength`, `run`, `walk`, `ride` and `other`. The same closed union existed in
the core domain and in the `activities_type_chk` database constraint.

`activities.activity_type` is the persisted modality identity. The start,
local-session restore, finalization RPC, feed, post composer, activity details,
statistics and PR pipeline all read this field. Several UI surfaces maintained
their own duplicate maps from these five identifiers to labels.

Dependencies found:

- `strength` owns strength sets, load, rest timer and saved workout plans;
- `run`, `walk` and `ride` own the tested GPS/native route path;
- strength PRs inspect only `strength`; 5K/10K PRs inspect only `run`;
- general duration, streak and active-day statistics include all activities;
- check-ins do not use `activity_type` and have an independent activity-day
  trigger;
- general circle rankings are social/streak-based; personal-record rankings
  remain scoped to their existing metrics;
- HealthKit currently normalizes imported workouts to the five legacy values;
- workout plans remain strength-only.

The old structure could not represent tennis, Pilates or swimming without
persisting them as `other`, losing their identity in history and feed.

## 2. Chosen architecture

`SPORT_CATALOG` in core is now the only modality source of truth. Each
`SportDefinition` contains:

- stable `id` and persisted `activityType`;
- Portuguese and English names;
- local-search aliases;
- icon key;
- internal category;
- current tracking capabilities;
- editorial popularity and deterministic default order;
- enabled state.

The canonical sport ID continues to be persisted in
`activities.activity_type`. This avoids a second nullable identity field and
keeps existing feed/RPC surfaces compatible. The prepared migration replaces
the five-value constraint with a conservative slug contract. The application
catalog, not the database, controls which sports can be started.

Unknown historical/provider values resolve safely to `other` in presentation
and personalization. Existing five identifiers keep exactly the same meaning.

## 3. Capabilities

Capabilities describe what the Gym Circle supports now:

- GPS, route and distance are enabled only for run, walk and ride;
- strength sets, plans and rest are enabled only for strength;
- every enabled sport can record duration;
- heart rate and calories are displayed only when a real source supplies them;
- sports with useful interval semantics declare interval support without
  implementing guided intervals in this sprint.

This contract can be consumed later by structured plans, professional
workspaces, AI drafts and watch apps without inferring behavior from labels.

## 4. Personalization

Favorites are explicit private preferences in
`user_sport_preferences`. Usage count and last use are derived from the user's
own recent activities, avoiding counters that can drift from history.

Ordering is deterministic:

1. active workout;
2. favorites;
3. usage count;
4. recency;
5. editorial recommendation;
6. default catalog order.

The migration enables RLS and permits only the authenticated owner to read or
change a preference. Controlled transaction tests confirmed owner CRUD,
cross-account isolation and rejection of cross-account writes.

## 5. UI

The chooser now contains:

- local search;
- a compact personalized "Most used" rail;
- category chips;
- compact modality cards;
- favorite controls;
- a bounded first page with "See all";
- existing saved workouts and recommendation card.

Search performs no network requests. Current workouts still restore directly
to the live screen from user-scoped local storage.

## 6. Compatibility

- Existing strength UI, plans, sets and PRs remain keyed by `strength`.
- Existing GPS bridge still receives only `run`, `walk` or `ride`.
- Feed, detail, integration sheet, completion summary and share cover resolve
  sport labels through the catalog.
- New modalities use session mode and duration-only tracking unless their
  declared current capability says otherwise.
- Check-ins, profiles and general streaks do not change.
- HealthKit and Apple Watch mappings were not changed.

## 7. Analytics

Prepared safe events:

- `sport_catalog_opened`;
- `sport_searched` (query length and result count, not query text);
- `sport_started` (sport ID and time to start);
- `sport_favorite_changed`;
- `sport_start_cancelled` for the future cancellation surface.

No location, free text or personal data is sent.

## 8. Migration and release gate

Prepared migration:

`20260723103000_sports_catalog_personalization.sql`

It:

- keeps all existing activities;
- relaxes only the closed activity-type list into a safe slug constraint;
- creates owner-only sport preferences;
- adds activity lookup indexing by user, sport and start time.

Completed before frontend publication:

1. review the migration and remote migration history;
2. apply the migration before the frontend;
3. validate favorite isolation between two users;
4. run typecheck, lint, unit tests and production build.

Physical iPhone QA remains a post-build release check for strength, the three
GPS activities and one duration-only sport. Supabase type regeneration remains
an isolated delivery because the current generated file has unrelated pending
changes.

## 9. Out of scope

No guided running, OCR, AI, ML, HealthKit, Apple Watch, import, trainer flow or
new native tracking was implemented.

## 10. Professional ecosystem readiness

Future professional templates should reference catalog sport IDs and capability
requirements, never localized names. A trainer, physiotherapist or nutritionist
workspace can scope plans and insights by the same stable taxonomy while
permission and consent remain separate concerns.
