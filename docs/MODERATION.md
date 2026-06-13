# Moderation and Safety Model

## Scope

DreamCards accepts visual UGC. Safety must cover upload, storage, discovery, play, reporting, review, appeal, and deletion.

The current implementation provides a deterministic preflight layer. It is not a complete production moderation system.

## Decision states

- `allow`: automated checks found no blocking condition.
- `review`: content is quarantined until an automated or human review completes.
- `reject`: content cannot enter public collections or matches.

## Current preflight

`ai/moderation/cardModeration.ts` checks:

- supported raster MIME type;
- positive file size within 8 MB;
- blocked metadata terms;
- one uploaded file per request.

Rejected metadata uploads are removed before a card record is created.

## Upload-to-card pipeline

Player uploads now follow a two-review process:

1. File preflight validates MIME type, size, and minimum dimensions.
2. A configured vision model reviews the source image. Production fails closed when visual review is unavailable.
3. An OpenAI-compatible image edit provider redraws the source with the versioned DreamCards style prompt.
4. If no image provider is configured or the request fails, Sharp produces a deterministic presentation-safe local style fallback.
5. The generated result is reviewed again.
6. Only an approved generated result is stored as a public card. The temporary source upload is deleted.

`IMAGE_ALLOW_LOCAL_REVIEW=true` exists only for offline development. It accepts dimension-valid images with an explicit low-confidence marker and should not be enabled on a public deployment.

The database records `sourceType`, `moderationStatus`, `generationSource`, and `styleVersion`. The original upload is not exposed through the game or archive API.

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
