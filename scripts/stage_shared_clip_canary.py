#!/usr/bin/env python3
"""Stage only the approved shared-clip canary, never change the ordinary Pages app."""
import argparse
from hashlib import file_digest, sha256
import json
import re
from html import escape, unescape
from pathlib import Path
from posixpath import relpath
import shutil
import tarfile
import tempfile
from urllib.parse import urljoin, urlparse, urlunsplit
from urllib.request import Request, urlopen

SCOPE = Path("experiments/shared-clips-test")
SESSION_IDS = {"OCF-FND-004", "OCF-EXP-007"}
COMPANION = "https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/smart-play-unlisted-input-20261125/"
RECIPES_DIGEST = "ee65a7f6bd53d9a6d72b49988dbd59fffd25708bec74b86ef153574c2ad612a8"
REMINDER_HASH = "8911c081552055681d2307b263945741c1d9389a8acfab61259a65a2f07a152c"
TOP = {"worker.mjs", "virtual-flac.mjs", "player.js", "preview.js", "smart-player.css"}
PUBLIC_JS = {"app.js", "docs.js", "editions.js", "learned.js", "playback-controls.js"}
BASE = "/" + SCOPE.as_posix() + "/"
PREVIEW_PAGES = {"/functions/": BASE, **{
    f"/functions/{fid}/": f"{BASE}functions/{fid}/" for fid in SESSION_IDS
}}

RECIPES = {"OCF-FND-004-reminder.json", "OCF-EXP-007-reminder.json", "OCF-EXP-007-off.json"}


def digest(path):
    with path.open("rb") as handle:
        return file_digest(handle, "sha256").hexdigest()


def integrity(path, receipt):
    if path.stat().st_size != receipt["bytes"] or digest(path) != receipt["sha256"]:
        raise ValueError(f"Canary source checksum or size differs: {path.name}")


def inventory(root):
    files = {}
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError("No symlink may enter the Pages artifact")
        if path.is_file() and path.name != "site-build-receipt.json":
            files[path.relative_to(root).as_posix()] = digest(path)
    return files


def catalog_originals(site, wanted):
    catalog = json.loads((site / "catalog.json").read_text(encoding="utf-8"))
    [edition] = [r for r in catalog["releases"] if r["version"] == "0.3.0"]
    selected = {}
    for function in edition["functions"]:
        fid = function["function_id"]
        if fid not in SESSION_IDS:
            continue
        [asset] = [a for session in function["sessions"]
                   if session["locale"] == "en-US" and session["voice_id"] == "mike-original"
                   for a in session["assets"] if a["format"] == "flac"]
        key = "original-" + fid
        if wanted[key] != {"sha256": asset["sha256"], "bytes": asset["size_bytes"]}:
            raise ValueError("Source differs from the sealed release catalogue")
        uri = urlparse(asset["download_url"])
        prefix = "/ocfproject-org/open-consciousness-functions-audio/releases/download/audio-0.3.0/"
        if uri.scheme != "https" or uri.netloc != "github.com" or not uri.path.startswith(prefix):
            raise ValueError("Not the exact expected original release origin")
        selected[key] = asset["download_url"]
    if set(selected) != {"original-" + f for f in SESSION_IDS}:
        raise ValueError("Required released originals are missing")
    return selected


def download(url, destination, expected):
    with urlopen(Request(url, headers={"User-Agent": "ocf-shared-clips-canary"}), timeout=45) as response, destination.open("xb") as target:
        resolved = urlparse(response.geturl())
        if resolved.scheme != "https" or resolved.netloc not in {"github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"}:
            raise ValueError("Unexpected release asset redirect")
        left = expected["bytes"]
        while left:
            data = response.read(min(left, 1 << 20))
            if not data:
                raise ValueError("Incomplete released original")
            target.write(data)
            left -= len(data)
        if response.read(1):
            raise ValueError("Released original is longer than sealed size")


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError("Public player integration point changed: " + old)
    return text.replace(old, new, 1)


def preview_scripts(site, staged):
    """Use this build's real controllers; only adapt storage and player integration."""
    for name in sorted(PUBLIC_JS):
        source = (site / "assets/js" / name).read_text(encoding="utf-8")
        if "window.localStorage" in source or "window.sessionStorage" in source:
            raise ValueError("Preview controller bypasses isolated storage: " + name)
        if name == "app.js":
            marker = "    const items = entries(catalog, documentation);"
            source = replace_once(source, marker, marker + """
    for (const item of items) {
      const id = encodeURIComponent(item.id);
      item.href = item.id === 'preparation-learning' ? '/preparation-learning/' :
        (window.ocfPreviewSupports(item.id) ? window.ocfPreviewBase : '/') + 'functions/' + id + '/';
    }""")
            for file in ("browse-catalog.json", "documentation-index.json", "source.json"):
                source = replace_once(source, "fetch('../" + file, "fetch('/" + file)
            marker = "      player.dataset.sessionLocale = item.locale;"
            source = replace_once(source, marker, marker + """
      if (item.edition === '0.3.0' && item.locale === 'en-US' && item.voiceId === 'mike-original'
          && window.ocfPreviewSupports(item.id)) player.dataset.localSmart = item.id;""")
            source = replace_once(source, "'ocf-surprise-selection'", "'ocf-canary-surprise-selection'")
        elif name == "editions.js":
            marker = "    document.querySelectorAll('audio[data-format-sources]').forEach(player => {"
            source = replace_once(source, marker, marker + """
      // Keep the current Smart Play stream when the separate original-format default changes.
      if (player.dataset.localSmartActive) return;""")
            source = replace_once(source, "const namePrefix = 'ocf-audio-edition:v1:';", "const namePrefix = 'ocf-canary-edition:v1:';")
            source = replace_once(source, "event.key === key", "window.ocfPreviewStorageKey(event.key) === key")
        elif name == "learned.js":
            source = replace_once(source, "event.key.startsWith(KEY)", "window.ocfPreviewStorageKey(event.key)?.startsWith(KEY)")
        elif name == "playback-controls.js":
            marker = "    return players.get(audio);\n  }"
            source = replace_once(source, marker, "    window.ocfLocalSmartInit(audio);\n" + marker)
        (staged / name).write_text(
            "((localStorage, sessionStorage) => {\n" + source
            + "\n})(window.ocfPreviewStorage('localStorage'), window.ocfPreviewStorage('sessionStorage'));\n",
            encoding="utf-8",
        )


def preview_pages(site, staged):
    preview_scripts(site, staged)

    def relative(path, scoped):
        return relpath(path, scoped) + ("/" if path.endswith("/") else "")

    def attributes(match, pathname, scoped):
        name, raw = match.groups()
        value = unescape(raw)
        url = urlparse(value)
        if url.scheme or url.netloc or not url.path or value.startswith("data:"):
            return match.group(0)
        path = urljoin(pathname, url.path)
        name_only = path.rsplit("/", 1)[-1]
        query = url.query
        if path.startswith("/assets/js/") and name_only in PUBLIC_JS:
            path = BASE + name_only
            query = "v=" + digest(staged / name_only)[:16]
        else:
            path = PREVIEW_PAGES.get(path, path)
        return f'{name}="{escape(urlunsplit(("", "", relative(path, scoped), query, url.fragment)), quote=True)}"'

    for pathname, scoped in PREVIEW_PAGES.items():
        html = (site / pathname.lstrip("/") / "index.html").read_text(encoding="utf-8")
        html = re.sub(r'(?<![\w:-])(href|src|data-(?:learned|transcript)-src)="([^"]*)"',
                      lambda match: attributes(match, pathname, scoped), html)
        durable = lambda n: relative(BASE + n, scoped) + "?v=" + digest(staged / n)[:16]
        additions = ('<meta name="robots" content="noindex,nofollow,noarchive">'
                     '<meta name="referrer" content="no-referrer">'
                     f'<link rel="stylesheet" href="{durable("smart-player.css")}">'
                     f'<script src="{durable("preview.js")}" defer></script>'
                     f'<script src="{durable("player.js")}" defer></script>')
        html = replace_once(html, '<meta charset="utf-8">', '<meta charset="utf-8">' + additions)
        if pathname != "/functions/":
            fid = pathname.split("/")[-2]
            pattern = r'<audio [^>]*\bdata-session-edition="0\.3\.0"[^>]*>'
            html, count = re.subn(pattern, lambda m: m[0][:-1] + f' data-local-smart="{fid}">', html)
            if count != 1:
                raise ValueError("Expected exactly one released preview player: " + fid)
        destination = staged / scoped.removeprefix(BASE) / "index.html"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(html, encoding="utf-8")


def stage(site, source, local_originals=None):
    before = inventory(site)
    dest = site / SCOPE
    if dest.exists() or SCOPE.as_posix() in (site / "sitemap.xml").read_text(encoding="utf-8"):
        raise ValueError("The unlisted preview must not already exist or be linked in the sitemap")
    allowed = TOP | {"data/inventory.json"}
    if set(inventory(source)) != allowed:
        raise ValueError("Unexpected file among canary release inputs")
    sealed = json.loads((source / "data/inventory.json").read_text(encoding="utf-8"))
    expected_assets = {"original-" + fid for fid in SESSION_IDS} | {"shared-reminder"}
    if set(sealed) != expected_assets or sealed["shared-reminder"]["sha256"] != REMINDER_HASH:
        raise ValueError("Unexpected relay assets or reminder")
    originals = catalog_originals(site, sealed)
    (site / "experiments").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=site.parent) as temporary:
        staged = Path(temporary) / "canary"
        shutil.copytree(source, staged)
        reminder = staged / "data/shared-reminder.flac"
        download(COMPANION + "shared-reminder.flac", reminder, sealed["shared-reminder"])
        integrity(reminder, sealed["shared-reminder"])
        bundle = Path(temporary) / "recipes.tar.gz"
        download(COMPANION + "packet-recipes.tar.gz", bundle, {"bytes": 1128181})
        integrity(bundle, {"sha256": RECIPES_DIGEST, "bytes": 1128181})
        with tarfile.open(bundle, mode="r:gz") as archive:
            members = archive.getmembers()
            if len(members) != len(RECIPES) or {item.name for item in members} != RECIPES:
                raise ValueError("Unexpected canary recipe files")
            for item in members:
                if not item.isfile() or item.size > 2_000_000:
                    raise ValueError("Unsafe canary recipe archive")
                with archive.extractfile(item) as recipe, (staged / "data" / item.name).open("xb") as output:
                    shutil.copyfileobj(recipe, output)
        for key, url in sorted(originals.items()):
            target = staged / "data" / (key + ".flac")
            if local_originals is None:
                download(url, target, sealed[key])
            else:
                shutil.copyfile(local_originals / (key + ".flac"), target)
            integrity(target, sealed[key])
        preview_pages(site, staged)
        staged.replace(dest)
    after = inventory(site)
    if {k: v for k, v in after.items() if not k.startswith(SCOPE.as_posix() + "/")} != before:
        raise ValueError("Canary unexpectedly changes a normal site payload")
    receipt_file = site / "site-build-receipt.json"
    receipt = json.loads(receipt_file.read_text(encoding="utf-8"))
    receipt["site_inventory_sha256"] = sha256(json.dumps(after, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    receipt["file_count"] = len(after)
    next_receipt = receipt_file.with_suffix(".tmp")
    next_receipt.write_text(json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    next_receipt.replace(receipt_file)
    print(f"Kept all {len(before)} baseline payloads byte-identical; added {len(after) - len(before)} unlisted files.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--local-test-originals", type=Path, help="Optional offline QA source, never used for production.")
    args = parser.parse_args()
    stage(args.site, Path(__file__).resolve().parents[1] / SCOPE, args.local_test_originals)
