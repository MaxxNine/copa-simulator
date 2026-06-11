# Prediction Storage Refactor Plan

## Objective

Reduce the cost of loading a user's predictions from up to one Firestore read
per match to one document read, without changing the current user experience or
breaking existing users.

The refactor must preserve:

- Draft prediction editing.
- Irreversible prediction locking.
- Anti-cheating visibility rules.
- Friend prediction viewing.
- Live and final leaderboard calculations.
- Existing prediction data and document IDs during migration.
- Compatibility while application code and Firestore rules are deployed at
  different times.

## Current Model

Each prediction is stored separately:

```text
predictions/{userId}_{matchId}
```

Loading a user with 72 predictions can cost approximately 72 document reads.

This model is useful for querying all predictions for a match, but inefficient
for loading all predictions belonging to one user.

## Target Model

### Private User Sheet

Store all of one user's predictions in a private document:

```text
prediction_sheets/{userId}
```

Example:

```json
{
  "userId": "user-123",
  "version": 1,
  "predictions": {
    "match_1": {
      "id": "user-123_match_1",
      "userId": "user-123",
      "matchId": "match_1",
      "homeScore": 2,
      "awayScore": 1,
      "locked": false
    }
  }
}
```

Use a map keyed by `matchId`, not an array. This permits direct field updates,
avoids duplicate entries, and does not depend on array position.

For approximately 104 World Cup matches, the document should remain far below
Firestore's 1 MiB document limit. Chunking is not required for this use case.

### Locked Prediction Documents

Keep an individually addressable document only when a user explicitly locks a
prediction:

```text
locked_predictions/{userId}_{matchId}
```

These documents support anti-cheating access before kickoff. They must never
contain unlocked drafts.

### Match Snapshot

When a match starts, create one immutable or append-only snapshot document:

```text
prediction_snapshots/{matchId}
```

Example:

```json
{
  "matchId": "match_1",
  "createdAt": "server timestamp",
  "predictions": {
    "user-123": {
      "homeScore": 2,
      "awayScore": 1
    }
  }
}
```

This document becomes the source for:

- Viewing friends' predictions after kickoff.
- Live leaderboard calculations.
- Final point calculations.

Snapshot creation must include both migrated sheets and unmigrated legacy
prediction documents.

## Security Invariants

1. `prediction_sheets/{userId}` is readable and writable only by that user and
   administrators.
2. Users cannot change `userId` or the schema version.
3. A user cannot update a prediction after it is locked or after the match is
   no longer scheduled.
4. `locked_predictions` contains only locked predictions.
5. A locked prediction is visible to another user only when the existing
   anti-cheating conditions are satisfied.
6. Match snapshots cannot be created or modified by ordinary users.
7. A private sheet must never be exposed to friends, groups, or broad queries.
8. Existing legacy rules remain active until migration and snapshot rollout are
   verified.

## Progressive Migration

### Read Path

Implement `getUserPredictions(userId)` as:

1. Read `prediction_sheets/{userId}`.
2. If it exists and has a supported version, return its predictions.
3. If it does not exist, query legacy `predictions` documents for that user.
4. Convert legacy results into a prediction sheet.
5. Write the new sheet as a best-effort migration.
6. Return the legacy results immediately; migration failure must not block the
   user.

Each user therefore pays the legacy read cost only on the first load after the
migration is deployed.

Use a transaction or create-only precondition when creating the initial sheet
so two simultaneous sessions cannot overwrite each other's migration result.

### Write Path

After a sheet exists:

- Saving a draft updates only the corresponding map entry in the private sheet.
- Locking updates the private sheet and creates the matching
  `locked_predictions` document atomically.
- Legacy `predictions` documents are no longer updated for migrated users.

During rollout:

- If the new rules are not deployed, fall back to the legacy write path.
- Do not silently report success unless at least one valid storage path commits.
- Record migration/write-path failures in console diagnostics.

### Legacy Compatibility

Legacy documents must remain untouched during the first release. They provide:

- Rollback capability.
- Input for snapshots involving users who have not logged in and migrated.
- Compatibility with an older deployed client.

Legacy cleanup is a separate final phase, not part of the initial migration.

## Match Start Workflow

The current client-admin flow is not sufficient for securely scanning every
private user sheet. Snapshot generation should run in a trusted environment:

- Firebase Cloud Function.
- Firebase Admin SDK script run by an administrator.
- A protected server route using Admin SDK credentials.

When a match changes from `scheduled` to `live`:

1. Read all migrated prediction sheets.
2. Extract the entry for the target match.
3. Read legacy prediction documents for the target match.
4. Merge by `userId`, preferring the migrated sheet for migrated users.
5. Include locked predictions from `locked_predictions`.
6. Write `prediction_snapshots/{matchId}`.
7. Store metadata such as source counts, schema version, and creation time.
8. Only then expose the match as live to clients.

Snapshot creation must be idempotent. Re-running it must produce the same result
without duplicate entries.

## Friend Prediction Reads

Before kickoff:

- Read only `locked_predictions` for friends.
- Preserve the current rule that the viewer must lock their own prediction
  before seeing another locked prediction.

After kickoff:

- Read `prediction_snapshots/{matchId}` once.
- Filter the snapshot against group member IDs in application memory.
- Cache the snapshot for the current session because it is immutable for that
  match state.

This reduces friend prediction viewing from many individual reads to one
snapshot read per match.

## Leaderboard Changes

Live and final scoring must use `prediction_snapshots`, not private sheets and
not only legacy prediction documents.

For each live match:

1. Read the match result.
2. Read its prediction snapshot.
3. Calculate temporary points in memory.
4. Merge temporary points into user totals.

Final score persistence should be handled in trusted backend code to prevent
clients from modifying another user's points.

## Firestore Rules Work

Add rules for:

```text
prediction_sheets/{userId}
locked_predictions/{predictionId}
prediction_snapshots/{matchId}
```

Rules must validate:

- Allowed top-level fields.
- Prediction score types and non-negative values.
- Ownership.
- Match status.
- Lock immutability.
- Document ID consistency.
- Snapshot admin-only writes.

Deploy additive rules before deploying code that depends on the new
collections. Do not remove legacy rules during the migration period.

## Indexing

Maps inside prediction sheets do not require query indexes because sheets are
read by document ID.

Potential indexes:

- `locked_predictions`: document-ID batch reads should not need a custom
  composite index.
- Legacy fallback query: retain the existing `userId` and `matchId` indexes
  until cleanup.
- Snapshot documents are read directly by match ID.

Exclude the `predictions` map in private sheets and snapshots from indexing if
the Firebase configuration supports field index exemptions. These maps are not
queried by nested value and indexing them wastes index storage.

## Rollout Phases

### Phase 1: Additive Foundation

- Add TypeScript types for sheets and snapshots.
- Add new Firestore rules without removing legacy rules.
- Add repository functions for sheet reads, migration, and writes.
- Keep the existing UI unchanged.

### Phase 2: Progressive User Migration

- Enable sheet-first reads.
- Migrate on first user load.
- Enable sheet-only draft writes for migrated users.
- Atomically publish locked predictions.
- Add telemetry counters or structured logs for legacy fallback use.

### Phase 3: Snapshot Infrastructure

- Implement trusted snapshot creation.
- Test snapshots with mixed migrated and legacy users.
- Switch friend views after kickoff to snapshots.
- Switch live leaderboard calculations to snapshots.

### Phase 4: Stabilization

- Monitor read/write counts and migration failures.
- Confirm all active users have sheets.
- Verify snapshots against legacy data for several matches.
- Keep legacy data available for rollback.

### Phase 5: Legacy Retirement

- Disable legacy writes.
- Remove legacy reads after an agreed migration window.
- Export or archive legacy prediction documents.
- Remove obsolete indexes and rules only after verification.

## Testing Plan

### Unit Tests

- Convert legacy documents into a sheet.
- Merge migrated and legacy predictions without duplication.
- Preserve locked state during migration.
- Prevent an unlocked prediction from overwriting a locked prediction.
- Build deterministic match snapshots.
- Prefer migrated data when both formats exist.

### Rules Tests

- User can read and update their own sheet.
- User cannot read another user's sheet.
- User cannot mutate identity fields.
- User cannot edit a locked prediction.
- User cannot edit after kickoff.
- Friend visibility remains blocked until anti-cheating conditions are met.
- Ordinary users cannot write snapshots.
- Admin/trusted backend can create snapshots.

### Integration Tests

- Existing user logs in and migrates without UI changes.
- New user starts directly on the new model.
- Two devices migrate the same user concurrently.
- Rules deploy before code.
- Code deploys before rules and uses fallback.
- User saves, reloads, edits, and locks a prediction.
- Mixed migrated and legacy users appear correctly in snapshots.
- Friend predictions remain private before locking.
- Live and final points match the current implementation.

### Cost Verification

Measure with the Firestore emulator or usage dashboard:

- Migrated login: one prediction-sheet read.
- First legacy login: one sheet miss plus legacy prediction reads.
- Draft save: one sheet write.
- Lock: one sheet write plus one locked-prediction write.
- Friend view before kickoff: batched locked prediction reads.
- Friend view after kickoff: one snapshot read.

## Rollback Strategy

- Do not delete legacy prediction documents during rollout.
- Keep legacy read helpers available behind a fallback.
- Use schema version `1` on every sheet and snapshot.
- If snapshot generation fails, do not transition the match to live.
- If the new model must be disabled, restore legacy writes and reads without
  changing UI contracts.

## Implementation Order

1. Add types and pure migration helpers.
2. Add additive Firestore rules and rules tests.
3. Add sheet-first read with best-effort migration.
4. Add sheet draft writes and atomic lock publication.
5. Add trusted snapshot generation.
6. Switch friend prediction reads to snapshots after kickoff.
7. Switch live/final scoring to snapshots.
8. Add monitoring and cost measurements.
9. Run mixed-data migration tests.
10. Retire legacy storage only after production verification.

## Acceptance Criteria

- Existing users see the same predictions and controls.
- Existing users migrate automatically on first load.
- Migrated prediction loading costs one document read in the normal case.
- Drafts remain private.
- Locked and post-kickoff friend visibility remains unchanged.
- Live and final scoring includes locked and unlocked saved drafts.
- Rollout works regardless of whether additive rules or application code deploys
  first.
- No legacy documents are deleted in the initial release.
- Production build, TypeScript checks, and Firestore rules tests pass.
