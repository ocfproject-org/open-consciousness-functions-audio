"""Install progressive-enhancement sharing on canonical public pages only."""
import re


def install(root):
    for page in root.rglob("*.html"):
        if page.relative_to(root).as_posix() == "my-morning/index.html":
            continue  # Personal reading space: no sharing affordance.
        text = page.read_text(encoding="utf-8")
        canonical = re.search(r'<link rel="canonical" href="https://ocfproject.org/[^"?#]*">', text)
        if not canonical or 'data-page-share' in text or 'http-equiv="refresh"' in text:
            continue
        depth = len(page.relative_to(root).parts) - 1
        base = "../" * depth
        controls = (
            '<div class="page-share" data-page-share hidden>'
            '<button type="button" data-share-copy>Share this page</button>'
            '<div data-share-status role="status" aria-live="polite"></div>'
            '<div data-share-manual hidden><label>Page link'
            '<input type="url" readonly data-share-url></label></div></div>'
        )
        text = text.replace('</head>', f'<link rel="stylesheet" href="{base}assets/css/share.css"><script src="{base}assets/js/share.js" defer></script></head>')
        # Keep long guides discoverable without duplicating controls in the footer.
        intro = re.search(r'<header class="page-intro function-intro"[^>]*>.*?</header>', text, re.S)
        if intro:
            header = intro.group()
            anchor = re.search(r'<p class="audio-preferences-context">.*?</p>', header, re.S)
            if not anchor:
                anchor = re.search(r'<h1[^>]*>.*?</h1>', header, re.S)
            if anchor:
                header = header[:anchor.end()] + controls + header[anchor.end():]
                text = text[:intro.start()] + header + text[intro.end():]
        else:
            text = re.sub(r'<footer class="site-footer"[^>]*>',
                          lambda match: match.group() + controls, text, count=1)
        page.write_text(text, encoding="utf-8")
