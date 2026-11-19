"""Bounded historical context, never a source of function content or instructions."""

import hashlib
import html
import json
from pathlib import Path

REFERENCES = json.loads(Path(__file__).with_suffix('.json').read_text())


def _disclosure(records):
    if not records:
        return ''
    rows = []
    for label, reference in records:
        source = REFERENCES['sources'][reference['source_id']]
        title = f"{source['title']}, PDF p. {reference['page']}"
        url = source['url'] + f"#page={reference['page']}"
        rows.append(f'<li>{html.escape(label)}<a href="{html.escape(url, quote=True)}">'
                    f'{html.escape(title)}</a> — {html.escape(reference["scope"])}</li>')
    return ('<details class="historical-references"><summary>References</summary>'
            '<p>Historical context only, not evidence of effectiveness or safety. '
            'Page numbers refer to the linked archive PDF reproduction.</p>'
            '<ol>' + ''.join(rows) + '</ol></details>')


def use_references(function_id, public_values):
    records = []
    for number, value in enumerate(public_values, 1):
        digest = hashlib.sha256(value['text'].encode()).hexdigest()
        for reference in REFERENCES['uses']:
            if (reference['function_id'] == function_id
                    and reference['text_sha256'] == digest):
                records.append((f'Example {number}: ', reference))
    return _disclosure(records)


def chain_references(title, markdown):
    # Changed chain text needs a new evidence review; a title match is insufficient.
    if hashlib.sha256(markdown.encode()).hexdigest() != REFERENCES['chain_document_sha256']:
        return ''
    reference = REFERENCES['chains'].get(title)
    return _disclosure([('', reference)] if reference else [])
