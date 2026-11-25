# Smart Play release checklist

Keep the regular site on GitHub Pages. Original playback does not use this
pipeline. Activate the Smart Play controls and help only once every eligible
recording from the selected edition is ready. A preview is not a release gate.

## Inputs and stages

1. Build and verify one original per eligible session and the shared clips. Save
   the exact clip hashes, natural checkpoints, independently reusable edit
   windows, packet indexes and small seam fragments. Never prepare one full
   render per option combination. Use the published version's catalog to validate
   master digests and the shared clip release receipt to validate clip digests.
2. Put only those approved files on a range-readable HTTPS media origin. Use
   immutable object URLs for a version; never change bytes behind a live URL.
   Keep the current version intact while staging a new one. If the destination
   cannot fit both versions, stop before replacing anything and report the
   actual capacity decision. Confirm byte ranges and CORS at the final host.
3. Run the release checks below, then publish the sealed index package to the
   project's approved companion release. Pin its digest in the Pages build.

       python scripts/seal_smart_play_catalog.py seal \
           --catalog verified-catalog.json --index verified-indexes \
           --registry media-registry.json --output sealed-smart-play \
           --edition "$AUDIO_EDITION"
       python scripts/seal_smart_play_catalog.py verify-ranges \
           --registry sealed-smart-play/registry.json --origin https://ocfproject.org

   The --full flag verifies every source chunk over the deployed host. Every
   fetch used by the browser verifies its read chunks against the sealed index,
   so a valid 206 by itself never counts as proof.
4. Build Pages with build_public_site.py --public-smart-play, then stage the
   checked media indexes with stage_public_smart_play.py. Validate the complete
   build; test all eligible sessions and representative choices from the actual
   Browse and guide routes. Check default playback, seek, current bookmarks,
   preference save, and unsupported editions. Only then activate the main
   deployment, and repeat the browser checks on the real site.

## Rollback

Before activation, pin the last successful exact source commit and Pages artifact,
including a checked copy independent of the GitHub artifact's expiry. Saving a
tag is not a rollback rehearsal. To revert, rebuild the prior exact site while
retiring the public worker: publish smart-play/rollback-worker.mjs, the no-fetch
worker, at the old root-worker script path. Do not change existing original
release URLs or delete the currently served media. Verify normal controls in a
previously open browser and a new tab, and that the old virtual route no longer
intercepts requests. Do not change the separate unlisted worker as part of a
regular rollout rollback.
