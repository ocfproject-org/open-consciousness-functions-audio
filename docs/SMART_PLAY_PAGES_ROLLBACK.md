# Isolated Smart Play media trial and rollback

The trial changes only the six opt-in media-only Pages repositories. Never link
an unverified shard from the regular site. Inputs are the same public GitHub
release files, not new masters or permutation renders. The source release and
original listening links remain untouched.

## Reusable release sequence

Generate the six manifests from the released catalog, public shared-clip
metadata, and verified local FLACs and inventory. Pass one exact
`--shared-release-tag` per already approved and published clip bundle. The
planner binds originals to the selected `audio-<edition>` tag, records the
approved clip tags in every manifest, and compares each file size and SHA-256
to the release proof. No tag list in the builder needs an edit for a new edition.

```sh
python scripts/plan_smart_play_media_pages.py \
  --edition "$edition" --catalog "$catalog" --shared "$shared_metadata" \
  --shared-release-tag "$clip_tag" --source "$verified_inputs" --output "$manifests"
python scripts/deploy_smart_play_media_pages.py "$manifests" "$receipts"
```

Run without `--apply` for a dry run. The dry run and all six Pages jobs use
the same manifest validation. The authorized `--apply` path pushes the same
builder and workflow template to the six dedicated projects, with one manifest
per project; use the authorized local GitHub session, not a workflow token
scoped to the source repository. Apply shard 01 first
when setting up the projects. Wait for its exact commit's workflow and verify
real browser cross-origin ranges before applying the remaining five. Check
every deployed media file's hash-proven ranges before considering activation.
Use the normal Pages CI and separate deployment gate for the main site.

## Isolate and clean up if the trial fails

1. Check that the regular site and the separate unlisted preview still use
   their original media paths (compare the approved live baseline hashes).
   If the public site was integrated later, restore the verified site's
   prior commit/worker or disable Smart Play first; keep Original working.
2. Save the receipt list of repository names, numeric IDs, and deployed commit
   IDs. Confirm the organization, repo IDs and media-only description before
   any change. Cancel only in-progress runs for those projects.
3. Disable Pages for the exact verified trial repositories if decommissioning.
   Confirm media URLs stop serving audio and normal and unlisted playback
   remain intact. Retaining or archiving the small code-only repos is
   reversible; deleting repos requires a separate explicit decision.
4. Never delete or edit open-consciousness-functions,
   open-consciousness-functions-audio, their releases, original files, or DNS
   as part of this cleanup. Website rollback has been rehearsed; no previous
   Smart Play audio is kept as a standby copy for latest-only releases.

## Production enablement and future editions

1. Use the site catalog for the approved audio release and the renderer's
   verified per-session indexes. Verify the public media range bytes with
   `seal_smart_play_catalog.py verify-ranges --registry ...`. Then run
   `seal_smart_play_catalog.py seal --catalog ... --index ... --registry ...
   --output ... --edition ...`. This emits the immutable bundle and its site
   pin for the exact approved release; no new full recordings are produced.
2. Publish `smart-play-indexes.tar.gz` as a public, non-latest companion with
   the tag in the generated `public-release.json`. Confirm the downloaded
   bytes match the pin. Copy that generated pin to
   `smart-play/public-release.json` in the audio-site PR. Do not replace
   earlier audio assets. CI downloads and validates the companion, builds the
   public site, and tests playback from the selected media origins.
3. Keep the prior website checkpoint and wait for the exact PR head's checks
   before merging. After Pages deploys, run
   `node scripts/check_public_smart_play.cjs https://ocfproject.org --all-sessions`
   and verify standard playback, earlier editions, and the separate preview.
4. For a later latest-only switch, six Pages projects publish one edition
   each. Do not assume that the previous Smart Play inputs will stay
   reachable during the switch. If needed, first remove the site pin with a
   normal validated deployment to turn off Smart Play and leave Original
   working. Then update all six media shards, verify them, and enable the
   new pin through the same workflow. Website rollback does not require
   maintaining a duplicate Smart Play audio catalog.
