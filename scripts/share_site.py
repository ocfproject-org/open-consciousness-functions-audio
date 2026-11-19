"""Install progressive-enhancement sharing on canonical public pages only."""
import re


def install(root):
    for page in root.rglob("*.html"):
        text = page.read_text(encoding="utf-8")
        canonical = re.search(r'<link rel="canonical" href="https://ocfproject.org/[^"?#]*">', text)
        if not canonical or 'data-page-share' in text or 'http-equiv="refresh"' in text:
            continue
        depth = len(page.relative_to(root).parts) - 1
        base = "../" * depth
        controls = '<details class="page-share" data-page-share hidden><summary>Share this page</summary><div class="page-share-actions"><button type="button" data-share-native hidden>Share…</button><button type="button" data-share-copy>Copy link</button></div><p data-share-status role="status" aria-live="polite"></p><div data-share-manual hidden><label>Page link<input type="url" readonly data-share-url></label><p>Select and copy this link.</p></div></details>'
        text = text.replace('</head>', f'<link rel="stylesheet" href="{base}assets/css/share.css"><script src="{base}assets/js/share.js" defer></script></head>')
        text = text.replace('<footer class="site-footer">', '<footer class="site-footer">' + controls)
        page.write_text(text, encoding="utf-8")
