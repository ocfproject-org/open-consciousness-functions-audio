# Website build and maintenance

## Source authority

Update `site/source.json` only to pin an exact reviewed source-repository
commit on the main branch that contains the public guide-exporter contract. The
Pages workflow fetches the full OCF history and fails closed unless that exact
commit is an ancestor of OCF main. Preview PR builds may use an unmerged source
branch commit for cross-repository validation, but that pin must be advanced to
the merged main commit before production Pages deployment. Do not add hand-edited
function records to this repository. The main OCF repository owns canonical
function identity, localized title/description, command/cue distinctions,
procedures, lifecycle, safety, categories, tags, common uses and approved
directional relationships. This repository owns layout, static-page
presentation and general listening/device editorial guidance.

The generated guide snapshot records the exact source commit and the exporter,
schema, per-function resource digests and build receipt. A build rejects a
missing/duplicate function ID, a source-pin mismatch, unsafe procedure status,
unreviewed relationships, invalid release catalog or broken local page link.
Only the exact 58-function en-US export is currently supported; no locale is
silently substituted.

## Local verification

The Pages workflow checks out the pinned public source commit and derives the
guide export. It refreshes release metadata from verified published manifests,
then builds in a separate staging directory:

```bash
python scripts/refresh_catalog.py --output verified-catalog.json
PYTHONPATH=ocf-source/scripts python -m ocf_tools.public_site_export \
  --source-commit "$(python -c 'import json; print(json.load(open("site/source.json"))["source_commit"])')" \
  --output public-guide-export.json
python scripts/build_public_site.py \
  --site-root site --content-dir docs/website \
  --source-pin site/source.json \
  --guide-export public-guide-export.json \
  --catalog verified-catalog.json \
  --historical-reference ocf-source/docs/releases/OCF_HISTORICAL_LOOKUP_CURRENT.md \
  --output verified-site
python scripts/validate_site.py verified-site
node scripts/test_catalog.js
node scripts/test_docs.js
npm ci
npx playwright install chromium firefox webkit
npm run test:browser:guard
npm run test:browser
```

`npm run test:browser` starts a static server over the exact generated
`verified-site/` directory. Playwright runs real browser checks and axe-core
WCAG 2.0/2.1 A/AA scans on all 58 generated function pages. The test suite
checks spoken-only cues and copy names, inactive-cue exclusion, the Sleep
procedure, keyboard navigation, filters, deep links, themes, transcripts,
responsive widths and a printed Quick Reference PDF. An injected unlabeled
button is a negative accessibility regression: the same axe gate must reject
it. A separate negative server regression starts a test-owned service on port
4173 and confirms Playwright rejects it rather than reusing it; if that port is
already occupied before the test starts, the test fails without terminating
the existing listener. In Pages, these checks run before `verified-site` is
uploaded; the deploy job depends on the complete validation job. A browser or axe test failure
therefore fails validation and prevents deployment. The public-safe browser
artifact includes test results, a print PDF and an acceptance receipt bound to
the pinned source commit, PR head (or pushed audio commit), exact CI-tested
commit, catalog and generated-site inventory hashes, and browser/tool versions.
The browser checks compare discovery status and Sleep steps against the exact
`public-guide-export.json` used for the build (override its path with
`GUIDE_EXPORT` for a custom local workspace). Served source provenance must
match the checked-in pin and build receipt.
CI installs and gates Chromium; Firefox and WebKit can be run locally with
`BROWSER=firefox` or `BROWSER=webkit`.

The build copies only the `txt` and `vtt` companions present in the verified
catalog. Each asset must match the published size and SHA-256 and uniquely
match one session's declared audio-master fingerprint. No private or
unpublished transcript is fetched. Browser player URLs remain the original
release URLs; the build does not download, convert, or republish audio.
Transient HTTP 429/5xx errors during companion retrieval receive at most two
bounded, delayed retries; permanent errors, redirects outside GitHub, and any
size/hash mismatch fail the staged build closed.

The deployment job uploads only the successfully validated artifact and has
separate Pages permissions. The checked-in `site/catalog.json` remains a
bootstrap catalog; it is not the deployed catalog source. A failed build cannot
replace the live Pages artifact.

## Technical media and human/device checks

Browser checks cover responsive widths, deep-link reloads, search, transcript
expansion and layout. Technical MP3 playback/seek probes, when performed, must
use one exact public edition URL, cap each byte-range request and record the
edition-matched TXT/VTT companion master fingerprint; this is not a full
download test. Audio links stay pinned to release assets. Each audio row also
offers a hash-free, descriptive local filename to copy; cross-origin release
responses may keep the server's hash-bearing filename, in which case rename it
in the device's file manager after download. The page does not fetch audio into
a Blob or buffer large files. The repository's three-platform test matrix runs Python
3.11/3.12 and Node 22. None of these checks establish physical-device
playback, hearing experience, native operating-system setting behavior,
release/listening approval, or medical efficacy. Record those boundaries in
PR and release reports.

## Shared audio edition preference

Generated pages bind script/style URLs to content hashes so a browser cache cannot
mix the new control with earlier edition logic.

Every page has an Audio edition control. New visitors follow Latest; choosing a
specific edition pins that choice until changed in this control. Browse, function
quick actions and players, Preparation Learning, Downloads/changelog, release
extras and home counts show the chosen edition. Documentation and source history
remain edition-independent. Clearing search/category filters does not reset the
edition. Surprise uses the selected edition while remaining independent of
search/category filters; changing edition affects the next surprise choice only.

The versioned localStorage preference `ocf-audio-edition:v1` is shared across
navigation/reloads and synchronized on restored pages and storage events. A
sessionStorage fallback retains the newest successful preference if local writes
fail. If both stores are blocked, a namespaced same-tab window name (only when
empty or already owned by this feature) and edition query parameters on site
links preserve navigation/reload and Back/Forward behavior. Unrelated window
names are never overwritten; those contexts retain the URL fallback. The previous Browse session
preference migrates once: its numeric latest default becomes Latest; an older
choice remains explicit. New explicit version choices stay pinned. Invalid/unavailable versions fall back to Latest.
Without JavaScript, the built page shows Latest and links to published releases
for historical access. Original release URLs, files and hashes never change.

A playing older-edition function player remains visible with an explicit close
control when the edition changes; it is never silently retuned. Browse retains
its existing active-player and selected-file provenance behavior. Downloads
renders only the selected edition's manifest-bound changelog. Browser gates cover
both editions, persistence, history navigation, blocked storage, static fallback,
active media, release URLs, source history and accessibility.

## Per-function source history

Each function guide has a native, initially collapsed **Function change history**
disclosure with up to five canonical-file revision records: commit date, verbatim
subject, and a commit link. These are source revision records, not curated
function-specific summaries. This bounded history is incomplete: older revisions
and changes to shared files are omitted. A commit may cover several files; inspect this
function’s diff. Text, cues, narration definitions and metadata revisions do not
establish that new audio was recorded. Audio remains bound to verified releases.

The builder reads Git history from the canonical checkout at the exact exported
source commit. Full history (`fetch-depth: 0`, used by both validation and Pages) and a HEAD
matching the pin are required; unavailable or shallow history fails the build.
Records use `git log --topo-order --max-count=5 <pin> -- <canonical path>`:
newer revisions precede their ancestors; commit dates need not be monotonic.
No rename traversal or history of shared templates is inferred. The full file
history link remains pinned to the same revision. An empty path history gets an
explicit unavailable-records message, not a claim that it never changed.

Subjects are escaped as text. No YAML history, draft editorial notes, commit
bodies, or narration content is copied into this disclosure. No hand-maintained
history database, export field, or build-time network fetch is added. The
rendered records are included in the existing generated-site inventory hash.
The native disclosure works without JavaScript.

## Shared audio format and Browse artwork

The same versioned preference now optionally includes `format`: MP3 (default) or
FLAC. Existing edition-only records migrate without losing their selected edition.
Both choices share storage fallback, history restoration and cross-tab updates;
when storage is blocked, site links carry both values. Choosing a format scopes
individual downloads, quick actions, file details and format-specific collection
ZIPs. Transcripts and non-audio companions remain available. Missing selected
formats show an unavailable message; Surprise never substitutes another format.
Surprise uses both selected edition and format, independently of search/category.

New and unused players follow the format. A used player retains its source and
bookmark until the user explicitly chooses Switch player; that action clears
old-format resume state, including pending metadata callbacks. Selected-file
review retains original format, URLs and hashes when hidden by preferences.

Browse cards use the existing published PNG companion matched to the session's
verified master fingerprint. No artwork is generated, mirrored or republished.
Images load lazily with asynchronous decoding and reserved square geometry at
96px (72px on narrow screens); missing or failed images retain the same space
with an Artwork unavailable fallback. Release URLs remain original.

## Function Chains URL

Function Chains uses `/function-chains/` as its canonical route, including all
navigation, internal links, metadata and sitemap entries. The former
`/practice-chains/` page remains as a static compatibility entry point: JavaScript
uses history replacement to forward the incoming query and fragment unchanged.
Without JavaScript (or if the redirect script fails), a visible accessible link
opens the canonical page; preserving arbitrary incoming query/fragment values
requires JavaScript on this static host. The alias is noindex, points its
canonical metadata to the new route, and is excluded from the sitemap.
The seventeen chains and their stable section anchors are unchanged.

### First-session and download presentation

Start Here presents Prepare → Choose → Learn → Use and a link to the Preparation
Learning player. Its approximate duration is calculated from the verified catalog
(current latest: 27m37s, displayed as about 28 minutes). Following the link does
not start or fetch audio. The narrow official Human Plus preparation exception
and the five optional starter practices remain available in disclosures. The
Preparation introduction summarizes existing preparation/return-to-waking guidance;
it adds no teaching sequence or canonical function instructions.

Preferences is a native modal reached from the header or contextual audio controls.
It contains the existing theme, edition and format controls and their storage
fallbacks. Close/Escape restores the invoking button. It never adds navigation
history entries; navigating away, Back/Forward restoration and reload dismiss stale
modal state. The mobile menu has one level; desktop retains its existing More menu.

Downloads enhances the complete static file inventory with title, approved spoken
cue and category search, initially showing 12 matching sessions and adding 12 per
Show more. Search and expanded count survive navigation/reload when session storage
is available; changing edition or format resets the visible subset. Without JavaScript,
all latest-edition files remain available, with historical release access unchanged.
Release notes and file metadata/checksums use native disclosures. Search and
preferences never fetch audio or change the immutable file targets.

### Function Chains discovery

The Function Chains directory groups the existing seventeen titles under the
page's introductory themes (Learning, Daily life, Rest, Reflection). This is
presentation metadata, not a new function registry or a new suggested sequence.
Search and goal selection narrow only directory cards. Every original section,
ordered step, paragraph, cue and deep-link anchor remains available below the
directory, including without JavaScript. Separate native disclosures link each
existing step to its function's listening and use-instruction anchors; they do
not activate a cue or start audio. The legacy route remains unchanged.

### Bounded historical references

The local reference prototype adds native, initially collapsed References
disclosures after selected common-use examples and outside original chain text.
`scripts/site_references.json` contains citation metadata only: public archive
PDF URLs, page locators, inspected-file hashes, and the limited scope supported
by each passage. It is not copied into the site as a second function registry.
Canonical example text still comes exclusively from the pinned guide export.

An example reference requires both its function ID and the exact approved-text
digest. Chain references require the unchanged chain document digest. Changed
content therefore omits stale references until its evidence is reviewed again.
Draft filtering runs before citation matching. Original examples, chain order,
anchors and instructions remain untouched. Historical overlap does not establish
the entire current chain, its order, clinical efficacy or safety. References
explicitly distinguish OCF additions from the documented pairing or context.

This initial subset is deliberately incomplete: absence of a citation is not a
claim that no historical context exists. Research inputs, OCR and page images
remain outside the repository; only verified public links and concise scope notes
belong in the presentation metadata. No archived teaching text is reproduced.

### Optional device-local affirmations

`/affirmations/` offers 36 original reflection prompts with text search and category
filters. These are a separate website helper, not canonical OCF functions or audio
instructions. `/my-morning/` is a bookmarkable reading view of only the current
browser's favorites. Neither route includes personal text or state in its URL.
No reminders, notifications, account, upload or analytics are added.

Saving a heart or a custom line requires explicit private-tracking opt-in. Custom
lines have stable random IDs, an existing category and at most 500 characters;
there may be up to 200 custom lines. Edit and remove are deliberate actions.
Imported text is displayed as text, never inserted as HTML or activated as a URL.
Browser storage is not encrypted; other people using that browser can read it.
Clearing site data removes it. Storage failure switches to clearly warned,
page-only memory, which can still be exported before leaving.

The main Preferences panel's **private backup** now exports schema 3:
`{schema, records, flags, affirmations: {custom, favorites}}`. Custom entries contain
only `{id, text, category}`; favorite entries are stable starter or custom IDs.
These files may contain personal text. The independent site-settings backup
continues to contain only theme, edition and format; it never includes affirmations
or tracking consent. No backup is uploaded.

Private schema 1 (learned records) and schema 2 (records and flags) remain accepted
and do not clear affirmations. Imports are validated within the existing 2 MiB
limit, previewed and explicitly confirmed. Merge retains existing lines; an ID
collision with different text/category becomes a deterministic separate copy,
including its favorite association. Repeated import does not duplicate that copy.
A newer schema is rejected without replacing saved data. Reset includes custom
lines and My Morning favorites, disables tracking and invalidates stale editors.
Cross-tab edits check the original line before saving or removing it.

Tests: `node scripts/test_affirmations.js` exercises the private data model;
`browser-tests/affirmations.spec.js` uses only synthetic personal data for CRUD,
imports, compatibility, storage failures, cross-tab behavior, keyboard, reflow,
accessibility and screenshots. Production user progress must not be read or used
for tests. Public builds contain only starter prompts and empty page shells.
