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
        controls = '<details class="page-share" data-page-share hidden><summary>Share this page</summary><div class="page-share-actions"><button type="button" data-share-native hidden>Share…</button><button type="button" data-share-copy>Copy link</button></div><div data-share-status role="status" aria-live="polite"></div><div data-share-manual hidden><label>Page link<input type="url" readonly data-share-url></label><div>Select and copy this link.</div></div></details>'
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
            text = text.replace('<footer class="site-footer">', '<footer class="site-footer">' + controls)
        page.write_text(text, encoding="utf-8")
