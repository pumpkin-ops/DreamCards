# Moderation and Safety Model

## Scope

DreamCards accepts visual UGC. Safety must cover upload, storage, discovery, play, reporting, review, appeal, and deletion.

The current implementation provides a deterministic preflight layer. It is not a complete production moderation system.

## Decision states

- `allow`: automated checks found no blocking condition.
- `review`: content is quarantined until an automated or human review completes.
- `reject`: content cannot enter public collections or matches.

## Current preflight

`src/moderation/cardModeration.ts` checks:

- supported raster MIME type;
- positive file size within 8 MB;
- blocked metadata terms;
- one uploaded file per request.

Rejected metadata uploads are removed before a card record is created.

## Target pipeline

```text
upload
  -> file validation
  -> malware/content-type verification
  -> perceptual duplicate check
  -> image safety signals
  -> allow / quarantine / reject
  -> player report
  -> human review
  -> appeal or enforcement
  -> auditable retention/deletion event
```

## Principles

- No single model decides irreversible enforcement.
- Provider output is a signal, not ground truth.
- Policy version and reason codes must be stored with decisions.
- Reviewers should see the minimum necessary personal data.
- Appeals must be possible for creator-owned content.
- Hidden gameplay tags must never become public card labels.
- Generated assets require provenance metadata and provider-policy compliance.

## Open work

- image-content review adapter;
- quarantine persistence;
- report and appeal APIs;
- reviewer interface;
- hash-based duplicate and known-abuse matching;
- policy localization;
- retention and deletion policy;
- transparency metrics.
