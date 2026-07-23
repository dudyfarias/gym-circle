# Modality Search and Personalization

## Local search

Search runs entirely in memory over `SPORT_CATALOG`. The index includes:

- Portuguese name;
- English name;
- stable ID;
- curated aliases.

Input and index are normalized with Unicode decomposition, accent removal,
lowercase conversion and punctuation folding. Every query token must occur in
the searchable text.

Examples:

- `tenis` and `TÊNIS` find `tennis`;
- `running` finds `run`;
- `bike` and `cycling` find `ride`;
- `soccer` and `football` find `football`;
- `martial` finds `martial-arts`;
- `cross` finds Cross Training and CrossFit.

There are no requests, autocomplete providers or remote query logs.

## Ranking

Ranking is lexicographic rather than an opaque score:

1. the active sport, when a chooser reuses the engine;
2. explicit favorites;
3. descending activity count;
4. descending last-used timestamp;
5. recommendation order;
6. deterministic default order.

This means a favorite always remains above a merely frequent sport, while two
favorites are still personalized by their real usage.

## Persistence

`user_sport_preferences` stores only explicit favorites:

- `user_id`;
- `sport_id`;
- `is_favorite`;
- timestamps.

RLS is owner-only. Removing a favorite deletes its row. Usage and recency are
queried from recent owner activities and calculated client-side.

The chooser applies optimistic favorite updates and rolls them back on error.
The workout start action remains usable even if personalization cannot load.

## UI behavior

- The initial rail shows favorites/used sports, falling back to catalog order.
- All sports are compact and category-filterable.
- The first page is bounded; "See all" expands it.
- A search or category filter shows all matching results.
- Empty search has a clear local fallback and never starts a request.

## Analytics privacy

`sport_searched` records query length and result count only. The raw query is
not sent because aliases or future free-form input could contain sensitive
text. Other sport events contain only catalog ID, boolean state and bounded
timing/count fields.
