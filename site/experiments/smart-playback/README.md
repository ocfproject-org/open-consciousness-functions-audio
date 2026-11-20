# Smart Playback public-delivery review — blocked draft

**This is not ready for the requested shortened-session audition. Do not deploy
it as a working Smart Playback preview.** It is a small, isolated review of the
public-release delivery path and explicit fail-closed controls. No private audio,
short insert, voice asset, private path, or new release is included.

`preview.html` is deliberately not named `index.html`, so the existing builder
does not add it to the sitemap. It has `noindex,nofollow`, no incoming site link,
no shared scripts/styles, no service worker, no analytics and no browser-state
writes. All files in this change live in this directory. The main website,
ordinary player, downloads, navigation and preferences are unchanged.

## What can be tested

- Explicit page-only opt-in; Full Guidance is the only available mode.
- Native playback of the published Comfort or Information Access MP3, audio
  0.2.0, directly from its immutable GitHub release URL.
- Selection stops/unloads the previous recording; no autoplay or replacement.
- Independent setting-aside, relaxation and return controls remain disabled.
  Manifest edits cannot enable unverified shortening.
- Exact public asset SHA-256, duration, master provenance and release identity.
  Values are projected from the repository's verified published catalog; this is
  not a second content registry or a browser claim to have hashed the full media.
- A bounded, explicit two-byte CORS/range probe with safe cancellation and no
  proxy, alternate host or rehosting.

## Actual delivery evidence

The Comfort MP3 is SHA-256
`401a132683e40b34576f8411c50096521429f4ee003c8d3d684f775fe07d76ec`,
55,927,570 bytes. A normal TLS-verified request followed GitHub's redirect to
`release-assets.githubusercontent.com`; it returned HTTP 206,
`Content-Range: bytes 0-4095/55927570`, and `Accept-Ranges: bytes`.
The final response had **no Access-Control-Allow-Origin header**. Signed redirect
query strings are not retained here.

Fresh Chromium against the actual URL decoded native duration 1387.357642 seconds
and advanced playback to 1.112091 seconds without a media error. Seeking was
tested. Cross-origin `fetch` failed under normal browser security. Native playback
is not proof of Web Audio access or audible hardware output. No AudioContext is
attached to the release element, avoiding cross-origin Web Audio silence.

A separately hash-verified copy of that same public asset decoded a one-second
stereo interval to 88,200 float sample values: peak 0.279909, RMS L/R
0.089591/0.088349. This is a decoder check, not a browser/hardware output measure.
Physical Android was not available; mobile verification is Chromium emulation.

## Why shortcuts are unavailable

The public release's timed text and technical sidecar do not provide the complete
joined exact-master speech/DSP safe-edit ledger. Silence or matching guide text
does not grant permission to splice or skip. The matching local short inserts
are private and are excluded. A successful private full-file listening comparison
does not prove browser transition quality or release compatibility.

Consequently neither native automatic seeking nor Web Audio replacement is
enabled. Quick Return eligibility is unverified and no early exit is offered.
Required learning, reinforcement, closure and Focus transitions are never cut.

The safe next path needs publicly authorized, immutable compatible short inserts
and reviewed exact-release timing/DSP evidence, plus a verified browser delivery
path. A CORS-capable approved origin would be needed for Web Audio; this PR does
not add a proxy or change hosting/security. A native seek alternative could be
considered only for independently reviewed safe windows—not derived from VTT
alone. Public distribution of private inserts requires separate authorization.

## Local tryout and checks

From the repository root, with its pinned npm dependencies installed:

```sh
python3 -m http.server 8791 --bind 127.0.0.1 --directory site
node site/experiments/smart-playback/test-review.cjs http://127.0.0.1:8791 /tmp/ocf-public-smart-evidence
```

Open `http://127.0.0.1:8791/experiments/smart-playback/preview.html` on that
workstation. This is a delivery diagnostic, not a meaningful short-session
audition. Return-to-Browse links resolve in the complete generated website.
Test output stays outside the repository. The test uses fresh browser state,
actual public release delivery, keyboard opt-in, source switching, mobile reflow,
axe, no outbound writes, no local state, and malformed identity rejection.
It does not claim that a synthetic test proves real audio transitions.

## Preview, production and rollback boundary

The existing Pages workflow deploys only `main`; there is no configured PR preview
environment. CI's browser evidence artifact is not a hosted application. This
draft does not change workflows, deploy Pages, or provide a live public audition.
The unlisted-path permission does not make Full-only playback a ready result.

If a later independently approved version is merged and deployed, rollback is
removal/revert of this directory followed by the normal successful Pages build
and deployment. Removal takes effect after that deployment and CDN/browser cache
expiry, not immediately when a revert is committed. Already-open pages can retain
their loaded original audio. There are no service-worker caches or persistent
experiment settings to clear. No rollback is needed for this unmerged draft.
