# Places P0 benchmark harness

This directory is isolated from the Gym Circle application. It never writes to
Supabase and defaults to dry-run mode.

## Safety contract

- Do not use public `nominatim.openstreetmap.org` for the benchmark. The OSM
  adapter rejects that host intentionally.
- Do not commit credentials or generated provider payloads.
- Reports discard raw provider responses. A temporary normalized top-five
  snapshot is retained only for human review and is never committed.
- Provider execution requires both `--execute` and `--allow-paid-requests`, a
  small explicit `--limit`, an equal or higher `--max-calls`, approved
  billing/quota, and the provider-specific environment variable.
- P0.6 external execution additionally requires `--subset=p0-6`,
  `execution_allowed: true`, and an `approved_execution_limit` of 3 or 10.
- The runner counts each actual HTTP request and aborts on the first provider
  failure. It never retries a paid request automatically.
- Only cases with `review_status=approved` are eligible for external requests.
- `uncertain`, `needs_correction`, `duplicate` and `remove` remain explicit
  blockers for the complete 160-case benchmark.
- A full 150–200 case run must be approved separately after licensing review.

## Environment names (values must remain outside the repository)

- `GOOGLE_PLACES_API_KEY`
- `APPLE_MAPS_TOKEN` (optional short-lived token generated outside this harness)
- `APPLE_MAPS_TEAM_ID`, `APPLE_MAPS_KEY_ID` and
  `APPLE_MAPS_PRIVATE_KEY_PATH` (alternative inputs; the harness signs a
  five-minute JWT and keeps the resulting access token only in memory)
- `MAPBOX_ACCESS_TOKEN`
- `OSM_NOMINATIM_BASE_URL` (authorized commercial or self-hosted instance only)

## Commands

```sh
node scripts/places-benchmark/validateCases.mjs
node scripts/places-benchmark/prioritySubset.mjs
node --test scripts/places-benchmark/*.test.mjs scripts/places-benchmark/providers/*.test.mjs
node scripts/places-benchmark/runBenchmark.mjs \
  --dry-run --subset=p0-6 --limit=10 --max-calls=10
```

The last command validates only the controlled ten-case subset, writes
`reports/readiness.json`, lists missing provider configuration, calculates the
planned call volume, and estimates Google costs with 0%, 30% and 70% of
searches resolved by the Gym Circle base. It never sends provider requests.

A real request is sent only when both execution guards are present. Example
after credentials, billing/quota, licensing, and the requested execution phase
have all been explicitly approved:

```sh
node scripts/places-benchmark/runBenchmark.mjs \
  --provider=apple \
  --subset=p0-6 \
  --limit=3 \
  --max-calls=4 \
  --execute \
  --allow-paid-requests
```

## Output and methodology

The harness records coverage, relevance rank, data-field completeness,
duplicate flags, latency, timeout, and rate limiting independently. It does not
emit one opaque overall score. The benchmark CSV uses approximate area
coordinates and includes a controlled `review_status` enum:

- `approved`: eligible for a controlled provider request;
- `uncertain`: requires independent manual confirmation;
- `needs_correction`: known field correction is pending;
- `duplicate`: must be resolved before the complete run;
- `remove`: excluded candidate pending removal.

The 87 cases that could not be independently verified without using a paid
provider as ground truth are deliberately marked `uncertain`; they are not
silently promoted to approved. Each row also records `review_method` and a
non-empty `review_note`, so the blocker is auditable instead of being inferred
from the former draft label.

## Controlled P0.6 subset

`p0-6-priority-cases.json` contains exactly ten approved cases and primary
evidence URLs. Only the three-case sanity phase is currently unlocked. The runner selects these IDs rather
than the first approved CSV rows. The sanity subset is fixed to Ironberg Barra
Funda, Smart Fit Shopping Light and Parque Ibirapuera. The current runner sends
one name-search request per case; a future four-query matrix would send 40
requests per provider. Validate it with `prioritySubset.mjs` before any
authorized run.

## Cost model

The readiness report uses explicit planning assumptions: completed
autocomplete sessions, 50/50 text and nearby search, one details request per
external search, reverse geocoding on 20%, and a dynamic web map on 25%. It
shows scenarios with no internal coverage, 30% resolved internally, and 70%
resolved internally. These are estimates, not invoices or a provider choice.
