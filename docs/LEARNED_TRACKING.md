# Private learned tracking

Learning is an explicit personal self-report. Listening, opening a page, choosing an
edition, and playback completion never mark or update it. Tracking is off until the
visitor enables it. This feature has no account, backend, telemetry, or network
writes. Progress and learned filters never enter URLs, session storage, or window
names. The browser fetches only the same public learning-data projection for every
visitor. People sharing a browser can see its records; exported backups also contain
private interests.

## Authority and identity

`learned_site.py` derives `assets/data/learning.json` from the existing pinned public
guide export and verified release catalog. This generated projection is not an
independent canonical registry. Its URL carries a content digest to prevent mixing
cached data with a later page build. The source repository, audio manifests,
recordings, transcripts, cues, release links and checksums remain unchanged.

Each saved function version records:

- Stable function ID and explicit self-report timestamp.
- Current website guide commit, locale, tracked public-field snapshot and SHA-256.
- Either an explicit guide-only choice or the visitor's explicitly selected audio
  tag, edition, locale, voice ID, recording source commit, frozen render snapshot,
  master digest and immutable audio asset IDs/formats/digests where published.

The guide snapshot includes reviewed description, reviewed active-command display
and spoken cues, usage/explanation, command roles/designations, effect and invocation
scope, public procedure status and documented steps, structural lifecycle fields,
reviewed lifecycle descriptions, and public safety notes. Text is NFC-normalized
with whitespace collapsed; JSON uses sorted keys and compact UTF-8 serialization.
The shared Unicode test vector verifies Python/JavaScript hashing parity.

It excludes common-use examples, tags, titles, relationships, historical commands,
draft content, unspecified lifecycle descriptions, raw YAML hashes and source
commits from the fingerprint. This is an incomplete guide-field comparison, not a
proof of material teaching or spoken equivalence. Guide commit changes alone never
make a saved edition stale. In particular, current guide `c79421a` and audio 0.2.0's
`3bcb8c1` plus frozen render snapshot are separate identities; additional common-use
examples do not change the fingerprint.

A newer published numeric edition with the same locale/voice gets “teaching changes
not verified” and a link to its verified release notes. A differing saved guide
snapshot can display old/current fields as plain text and fixed source-commit
links. Imported snapshots are explicitly unverified personal claims. A saved audio
identity absent from the current catalog, including the same tag with a different
digest, is labeled unverified and retained. No guide or catalog change automatically
unlearns, replaces or upgrades a record. Save another version deliberately.

Preparation is separate from the 58 functions. OCF Preparation requires an explicit
recording choice. Official Human Plus preparation is a separate self-report with
unknown external edition/date unless supplied. It assigns no OCF edition and makes
no equivalence claim. Existing canonical preparation exception wording is unchanged.

## Storage and backups

The `ocf-learned:v1` settings key stores schema 1 and a random epoch. Each immutable
version uses `ocf-learned:v1:record:<epoch>:<identity-derived-id>`. Separate keys
avoid whole-list lost updates between tabs; identity-derived keys deduplicate the
same version. A reset disables tracking before removing records. Async saves
recheck the epoch after validation, so an intervening reset is respected. Storage
and page-show events refresh the view without writing cached lists back. Concurrent
save versus removal of the very same identity is last-operation-wins; unrelated
versions are preserved. This is browser storage, not a transactional database.

Backup shape is `{ "schema": 1, "records": [...] }`. Each record has exactly
`id`, `subject`, `markedAt`, `guide`, `recording`, and `external` fields. Import rejects
unknown/future schemas, unknown subjects, extra fields, invalid types/identities,
invalid snapshot hashes, duplicate identities, oversized input and malformed JSON
before changing anything. Limits: 2 MiB backup, 500 records, 64,000 serialized
characters per record, 256 tracked fields, bounded strings. Preview shows additions
and duplicates; a separate explicit confirmation merges only new versions. Imported
IDs cannot overwrite different versions. Text is always rendered with `textContent`;
no imported HTML or arbitrary URLs become active. Unsupported future/removed IDs
need a future migration; they are rejected with a clear message, not silently lost.

Remove and reset require deliberate confirmation. Corrupt stored records are
reported and skipped without deleting them. A corrupt/future settings schema needs
an explicit reset. Export includes the readable active records only.

If browser storage is blocked or runs out of quota, new changes remain in memory
for the current page only, with a visible warning. Previously persisted versions
are not overwritten. A partially persisted import can be safely retried because
identity keys deduplicate; all validated records remain available in the current
page's memory. Export before leaving. A failed deletion/reset explicitly warns that
browser copies could not be fully removed; browser site-data controls are needed.
No persistence claim is made for memory fallback.

## Integration and validation

New files own projection, UI, scoped styles and tests. Builder touchpoints are one
installation call before asset hashing and stable-ID attributes on static directory
cards / Quick Reference rows. `app.js` and `docs.js` compose their existing filters
with a page-local learned predicate and react to one event. Active unmatched players
retain the existing pin behavior. `editions.js`, onboarding, navigation, downloads,
source pins, releases and narration are unchanged. One validation-workflow step runs
the new dependency-free Node checks; Python and browser suites discover their new
tests automatically.

Run:

```sh
python -m unittest discover -s scripts -p 'test_*.py'
node scripts/test_learned.js
# Also validate every generated guide/recording identity:
SITE_DIR=verified-site node scripts/test_learned.js
# After the usual pinned build:
SITE_DIR=verified-site GUIDE_EXPORT=public-guide-export.json npm run test:browser
```

The feature composes with the shared Preferences dialog and presentation guidance.
Review the combined build and required CI before merging; this feature does not
change or republish audio releases.
