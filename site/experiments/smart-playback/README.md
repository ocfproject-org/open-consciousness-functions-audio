# Comfort public-file Smart Playback experiment

One isolated, unlisted page: `experiments/smart-playback/preview.html`.
It is noindex/nofollow, omitted from navigation/sitemap, uses no shared scripts,
styles or service worker, and writes no persistent state. Full remains default.
No audio, voice assets, private timings or private paths are included in this PR.

## How it works

The original public Comfort 0.2.0 MP3 plays natively from its immutable GitHub
release URL. A fresh actual range request returned 206 with byte ranges but no
Access-Control-Allow-Origin. Therefore remote playback is never attached to Web
Audio: that would silence it. No proxy or security exception is introduced.

For Short relaxation, the reader downloads that original MP3 and chooses it with
a file input. The browser checks its exact 55,927,570-byte size and SHA-256:
`401a132683e40b34576f8411c50096521429f4ee003c8d3d684f775fe07d76ec`.
The file is read locally, never uploaded. Its name/path is not displayed, stored
or sent. Two media elements share the same local File/blob URL; the browser does
not decode the whole session into an AudioBuffer or create another full track.
The checksum temporarily reads the compressed file into memory; this is not a
zero-memory streaming checksum. Reload discards the file selection and settings.

Short relaxation retains every number One through Ten, about six seconds between
numbers, the full relaxation introduction and Ten guidance. It omits the nine
detailed body-scan units following One through Nine. Nine 200 ms stereo equal-power
crossfades join speech-free margins of the exact public recording. Full box
instructions/action time, every later learning/closure/reinforcement stage and
Comfort's complete ending remain intact. No Quick Return is available.

Decoded Full: 1387.357642 seconds (23:07.4).
Short relaxation: 1144.437824 seconds (19:04.4).
Savings: 242.919818 seconds (4:02.9), including nine overlaps.
Container duration 1387.389388 differs slightly from decoded duration.

Preparation remains independently Full/disabled: the public measured ledger
bounds whole box paragraphs, not a faithful short reminder sentence. This page
does not invent a boundary or reuse a private reminder. Choosing either mode
pauses playback; missing/late buffers fail closed to paused Full. The original
player/download remain available independently of local Web Audio support.

## Exact source and rights boundary

Public release:
<https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/tag/audio-0.2.0>

The source identity comes from its verified publication manifest
`d75262e2ebd70fcb768bfb6f7cca207fa644bfbee83d6be9cfa94924319e3c43`.
The public master identity is
`fea70d6b1979827d74f785b313d53e90d7acf82fb140a9c9aced9c96e2a545bf`;
the exact retained render report and delivery receipts were checked locally.
Only safe public-recording boundary projections appear in `evidence.json`.
Its canonical JSON digest is checked before the UI enables experiments.
Neither that report nor its paths/private envelope is published.

No separate audio redistribution license was established from the audio repository
or release notes. This implementation consequently republishes NO snippets or
full tracks and makes no claim that the source software's Apache license covers
voice recordings. It uses the owner's already-public recording selected by the
reader, within the explicitly authorized experiment. No synthesized/private
narration, private insert or new release is involved.

## Verification and reproduction

With the pinned Playwright dependencies installed, serve `site` on loopback:

```sh
python3 -m http.server 8791 --bind 127.0.0.1 --directory site
node site/experiments/smart-playback/test-review.cjs \
  http://127.0.0.1:8791 LOCAL_RESULTS_DIRECTORY OPTIONAL_PUBLIC_MP3
node site/experiments/smart-playback/test-output.cjs \
  http://127.0.0.1:8791 LOCAL_PCM_DIRECTORY EXACT_PUBLIC_MP3
```

The output harness explicitly loads `test-capture.mjs` to measure actual stereo
PCM. The page itself never imports it or records audio. Test outputs stay outside
the repository. A synthetic or incorrect file cannot enable Short modes.

The bounded real-file proof captured all nine joins twice on desktop and 375px
mobile emulation (36 windows), with zero digital-zero gaps and no clipping.
All 36 following-count excerpts matched exact public-source decode; minimum
channel correlation was 0.99967. This is digital output, not physical hardware
sound or a human listening approval. Continuous playback traversed all nine joins (18 scheduler transitions) on
both desktop and mobile emulation without silent gaps or fallback. UI acceptance
and output receipts are retained locally; physical Android remains untested.

## Isolation and rollback

All changes remain under this directory. Existing main player, homepage,
preferences, navigation, downloads, catalog and service-worker behavior are
unchanged. No release, upload, analytics or network-write endpoint is added.
There is no configured PR preview; Pages publishes only checked main commits.
Do not describe a local tryout as a deployed URL.

Rollback is reverting/removing this directory through the normal checked Pages
workflow. It takes effect after successful deployment/cache refresh. Already-open
pages may retain loaded code/local blobs until closed; no experiment storage or
service worker remains to clear.
