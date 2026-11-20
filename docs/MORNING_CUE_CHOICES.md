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
not saved rows. This intentionally bounded catalog contains two independently
checked public booklet commands, not a projection of OCF historical aliases:

| Stable identity | Original title | Printed command | Public reference |
| --- | --- | --- | --- |
| `hplus-off-loading-1988` | Off-Loading | PLUS-FADE, FADE | [Original card](https://archive.org/details/function-off-loading), card code 88R1035; also complete booklet |
| `hplus-attention-booklet` | Attention | PLUS-FOCUS | [Complete booklet](https://archive.org/details/hfunction-exercises-complete-booklet), Attention section |

Verification used the public OCR of the [Off-Loading card](https://archive.org/stream/function-off-loading/Off-Loading_djvu.txt)
and the [complete booklet](https://archive.org/stream/hfunction-exercises-complete-booklet/%20Human%20Plus%20Function%20Exercises%20-%20Complete%20Booklet_djvu.txt).
Only the brief command words are included; no scripts or instructional prose are
copied. Reading text uses title case and spaces in place of printed punctuation;
word sequence and repeated words remain intact. Catalog IDs and their text are
immutable. No date/edition is guessed for Attention.

Other original commands are omitted pending individual public-source verification.
The existing legacy map is not used to infer originals: its availability and
compatibility fields do not identify every command's role or provenance. In
particular, Plus Clear is not substituted for the original Off-Loading command.
No aliases or historical text are added to OCF guides.

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

Pre-update builds do not support schema 5 and reject it before applying records;
there is no forward-compatibility claim. Existing custom/function rows are not
encoded differently. Same-browser downgrade cannot read a mixed saved routine;
it reports unsupported data and must not overwrite it. Export a private backup
before changing site versions. No routine data enters site settings exports,
URLs, analytics or public artifacts. The existing 50-row limit is unchanged.
