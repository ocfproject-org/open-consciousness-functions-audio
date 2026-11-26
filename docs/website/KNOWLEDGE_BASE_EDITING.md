# Maintaining Learn

The Learn pages are built from `knowledge-base.json` (schema 2). Update that file
rather than editing generated HTML. Use the regular Pages build and validator,
then run the Python tests and `browser-tests/knowledge-base.spec.js` against the
built site. The short Glossary and FAQ remains a quick orientation.

- Keep IDs stable within each section. A concept and a question may have the
  same ID on different routes. Treat Miranon as its own historical namespace.
- Use source IDs and locators in evidence. Retain older source IDs as aliases.
  Treat a dated Wayback capture as availability, not proof of reviewed text.
- Keep held entries, source-access diagnostics, editorial overlays, and private
  references outside this repository. The public JSON contains only reviewed
  reader content. The separate local review sheet is not a build input.
- Keep exact instructions in the function guides and Quick Reference. Update
  the Listening Guide for player behavior; the concept FAQ links back to it.
  Compare practice wording to the edition-matched transcript and pinned guides.
- Review editorial content and claims before publishing. Do not add supplied
  PDFs, private recordings, voices, or audition files to the repository.

Put reviewed reader copy and public source links directly in `knowledge-base.json`.
Prefer free informational sources to product listings. Do not add a private
research package or unpublished reference to the public repository.

For a citation audit, check the claim against the cited source, not just the
HTTP response. Link readers to a free full-text copy when available. Keep
retrieval diagnostics in the editorial notes, and do not treat a community
excerpt, historical account, or program description as efficacy evidence.
