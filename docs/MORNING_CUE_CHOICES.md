# My Morning cue choices

Saved catalog choices are omitted from the picker (including search and reload).
Removal restores a choice. A second Add guard rejects an equivalent saved choice.
Existing rows, including old duplicates, are never deduplicated or rewritten.
OCF equivalence uses function/command identity, locale and cue wording; different
commands or genuinely different wording remain separate. Equivalent Learned and
current guides prefer the saved Learned snapshot. Saved guide provenance is not
proof of recording cue equivalence.

## Optional original Human Plus coverage

The checkbox starts unchecked each time the editor opens. It only affects choices,
not saved rows. The reviewed catalog contains 65 concise cue facts across 55
original titles, with explicit context for each command. These are historical
Human Plus cues, not claims about current OCF audio or current availability.

`scripts/morning_originals.json` is the reviewed My Morning-only input. Twelve
wordings are individually corroborated in explicit public archive command fields;
53 are labelled **Project-recorded**, not individually archive-verified. Review
corroboration does not establish listening, audio equivalence or effectiveness.
Only concise titles, commands, identities and public citation locators are kept;
no research document, source prose or private path is included.

The builder validates every command ID/printed notation against
`record_metadata.legacy` in the pinned canonical resource, using guide receipt
paths, SHA-256 hashes and function identities. It rejects resource/pin drift,
unknown identities, changed role contexts and a stale generated model catalog.
The source pin remains unchanged. Neither `historical_lookup`, current commands,
source availability nor generated alias lists authenticate an original cue.

The catalog block in `morning-state.js` is generated with
`morning_originals.catalog_script(morning_originals.load_catalog())`; the build
checks this exact block. No additional browser request or storage schema is added.
Human Plus rows continue to store only UUID, kind, catalog command ID and exact
reading text. In particular, `hplus-attention-booklet` / `Plus Focus` and
`hplus-off-loading-1988` / `Plus Fade Fade` remain byte-exact. Printed historical
notation is retained separately from readable case and punctuation.

Five commands require explicit role/context labels:

| Original context | Command | Role |
| --- | --- | --- |
| Contemplation | PLUS-CLOSED | Close |
| Imprint | PLUS-RECALL | Retrieval |
| Short Fix | PLUS-RELEASE | Short Fix release |
| Zoning | PLUS-CANCEL | Cancel |
| Release | PLUS-RELEASE | Standalone release |

They are included, not held as uncertain wording, and are not labelled generic
activations. The picker searches original titles, cue text/notation, command IDs,
roles and evidence labels. Search normalization affects matching only. A selected
cue summary exposes context and evidence on small screens before Add.

Fifteen context-specific lookup aliases are explicitly excluded in the review
input. They are not additional original commands in those function contexts.
For example, Strong-Quick's `Plus Release` lookup is excluded, while the genuine
standalone Release and Short Fix release commands remain separate choices.
The numerical Comfort/Sleep words and retired OCF aliases are not substituted
for the reviewed historical notation. No global word ban or text-only identity
merge is applied. All 65 reconciled cues are included; no unresolved wording
exclusions remain beyond the 15 listed lookup pairs.

Focus has identical words in the two systems. The checkbox offers one choice:
OCF when off, explicitly labelled Human Plus when on. If either is already saved,
neither appears as another Add choice. Turning the checkbox on/off never changes
the source of a saved row. Offload and Fade Fade remain distinct choices. Command
identity remains authoritative for other OCF commands/modes, even with equal words.

## Backup boundary

Schemas 1–4 continue to import with their existing scopes. Schema 4 export remains
in use when no Human Plus rows exist. A mixed routine exports schema 5 with an
explicit `hplus` row: UUID, immutable catalog command ID and exact reading text.
The new parser checks both identity and text against its bounded public catalog;
imports cannot inject source URLs, labels, unknown commands or arbitrary fields.
Routine order and IDs survive export/import, and normal merge semantics remain.
Schema 4 rejects Human Plus rows rather than silently extending its old contract.

Builds before original-cue support reject schema 5 before applying records.
Builds with only the first two originals reject newly added catalog IDs. There
is no forward-compatibility claim. Existing custom/function rows are not
encoded differently. Same-browser downgrade cannot read a mixed saved routine;
it reports unsupported data and must not overwrite it. Export a private backup
before changing site versions. No routine data enters site settings exports,
URLs, analytics or public artifacts. The existing 50-row limit is unchanged.
