# Isolated Smart Play media trial and rollback

The trial changes only the six opt-in media-only Pages repositories. Never link
an unverified shard from the regular site. Inputs are the same public GitHub
release files, not new masters or permutation renders. The source release and
original listening links remain untouched.

## Reusable release sequence

Use the generated immutable manifest and one workflow template for all six
projects. Run scripts/deploy_smart_play_media_pages.py with the manifests and
local receipt workspace, without --apply for the dry run. Apply shard 01 first
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
