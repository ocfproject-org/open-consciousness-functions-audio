# Isolated Comfort streaming experiment

`experiments/smart-playback/preview.html` is unlisted and noindex/nofollow.
It uses no shared app scripts, persistent state, service worker or site navigation.
Full remains default; the canonical native release player/download is independent.

## Public source and distribution boundary

Only the exact already-published Comfort 0.2.0 MP3 is staged at build time:
55,927,570 bytes, SHA-256
`401a132683e40b34576f8411c50096521429f4ee003c8d3d684f775fe07d76ec`.
The immutable GitHub release remains canonical. Its final release-assets host
supports ranges but has no CORS header; the verified catalog has no official
mirror. Neither no-cors fetch nor a service worker would enable Web Audio there.

The owner specifically authorized the isolated live experiment and requested an
exact same-origin public-media build artifact to remove the rejected file-picker
flow. This narrowly scoped mirror is an exception to companion-only Pages copying,
not an inference that the source-code license licenses voice recordings generally.
No private/new narration, private inserts, media commits, altered release or other
recording is included. `scripts/smart_playback_media.py` pins URL, byte size and
SHA-256; it bounds the download, limits HTTPS redirect hosts, verifies before an
atomic rename, and preserves existing files on failure. The site builder rechecks
the bytes before the inventory receipt. Both CI and Pages validate that exact
artifact; the deploy job adds nothing. See `docs/WEBSITE.md`.

The page checks early and late same-origin 4096-byte responses for exact 206 ranges,
length and audio MIME before enabling the experiment. The build proves the entire
asset's identity; two runtime probes are delivery checks, not a replacement hash.
No manual file selection, account or upload is involved. Two native media elements
buffer the same file; no full-track AudioBuffer or second full-track variant exists.

## Scope and timing

Short relaxation retains One through Ten, approximately six seconds between
numbers, the complete relaxation introduction and Ten guidance. It omits the nine
detailed body scans after One through Nine. Nine 200 ms equal-power stereo fades
use measured speech-free margins. The box exercise/action time, learning,
reinforcement, closure and complete Comfort ending remain intact. Preparation
stays Full: a faithful short public reminder boundary has not been verified.
No Quick Return is offered.

Decoded Full: 1387.357642 s (23:07.4).
Computed Short: 1144.437824 s (19:04.4), saving 242.919818 s (4:02.9).
These are the edit plan's durations, not a claim of sample-exact HTML media clocks.
The container duration is 1387.389388 s. Mode changes pause; unavailable/late media
falls back to paused Full. Reload resets choices. Backgrounding pauses deliberately.

Public publication manifest:
`d75262e2ebd70fcb768bfb6f7cca207fa644bfbee83d6be9cfa94924319e3c43`.
Public master:
`fea70d6b1979827d74f785b313d53e90d7acf82fb140a9c9aced9c96e2a545bf`.
Only the safe boundary projection is included in `evidence.json`, checked by digest.
Private render reports, voice packs, timelines and paths are not included.

## Click investigation and safeguards

The prior Android report included clicks away from joins. Do not treat zero
samples, peak bounds, a playing flag or currentTime alone as proof of clean audio.
The revised scheduler mutes before starting/seeking, ramps pause/resume, holds an
in-flight gain before cancelling automation, seeks only inactive slots, and uses
the outgoing media clock. It schedules equal-power ramps on AudioContext time;
it does not seek the outgoing stream to catch up. An unready/missed overlap pauses
and falls back rather than silently jumping. This does not establish physical
Android output quality; owner confirmation is still required.

Tests: `test-review.cjs BASE OUTPUT` checks no-picker playback, defaults, mobile,
keyboard-compatible controls, axe, no outbound writes and reload. `test-failures.cjs
BASE OUTPUT_JSON` covers missing/bad ranges/MIME/evidence, late buffers and hidden
page handling. `test-output.cjs BASE OUTPUT` captures both channels over all nine
joins twice per viewport. Use a range-capable loopback server containing the exact
verified build; Python's simple server is insufficient for the delivery probes.
No tests access personal browser data. PCM captures are local ignored evidence,
not public audio artifacts. A successful emulated test is not a handset test.

Rollback: revert this scoped change through the normal validated Pages workflow.
The old main player/releases remain available throughout. The mirror disappears
when the replacement artifact is deployed; cached responses may expire later.

### Local evidence for the streaming revision

The matched steady-state comparison captured 20 seconds per cell: old/new ×
native/pass-through/Short × desktop/mobile emulation (12 captures, 240 seconds).
Short 5:00 maps to original 9:02.919818, away from every join. A 35 ms main-thread
load ran every 120 ms. Both channels were aligned to a 48 kHz decode of the exact
pinned MP3, with a common fractional-sample shift and fitted gain. Maximum residual
RMS was 0.00002731 before and 0.00002564 after; peak residual was 0.0009416 before
and 0.0007413 after; minimum channel correlation exceeded 0.99999995. All passed
an impulse residual gate, and an injected single-frame 0.1 impulse failed it.
This did NOT reproduce the reported Android steady-state click; it is not evidence
that the phone issue is eliminated. No physical Android or hardware-output test
was performed. The revised scheduling removes observed race opportunities, while
phone confirmation remains necessary.

The Android screenshot showed the older fallback rejecting a browser without
`AudioParam.cancelAndHoldAtTime`. The player now uses standard timed linear
ramps with tracked interpolation when that optional method is absent. This
preserves hold-and-ramp behavior without changing the source track or the
desktop native fade. The mobile browser regressions explicitly remove the
method before playback to exercise the reported capability gap; handset review
remains separate.

Thirty-six repeated join captures (nine joins × two repeats × two viewports) had
no digital-zero run, no fallback, peak ≤0.4840 and maximum adjacent-sample step
≤0.07310. Separate continuous runs traverse all nine joins and exercise resume
inside overlaps. These bounds complement, rather than replace, the aligned
steady-state residual test. Pause gaps are intentional and measured separately.

At shaped 1 Mbps/100 ms latency, a cold late seek took about 24.1 seconds before
five seconds of measured stereo output (RMS 0.09063/0.09087); a warm seek resumed
in about 38 ms before the one-second observation. Total public-asset transfer was
3,770,843 bytes for that test, not a sustained-throughput measurement. At 256 kbps,
the cold seek reached the 30-second readiness deadline and safely paused in Full;
no output was claimed. The MP3's mean bitrate is about 323 kbps. Slow connections
can therefore require substantial buffering; the UI says Buffering explicitly.

Reproduce matched captures locally against separately served old/candidate builds:
`node capture-steady.cjs BASE OUTPUT before|after`, then
`python verify_capture.py --source EXACT_PUBLIC_MP3 --captures OUTPUT`.
The old baseline needs the same verified file served locally for this controlled
comparison; it is not a proposal to use the rejected file picker again.
