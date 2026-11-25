#!/usr/bin/env python3
"""Seal verified per-session indexes and preflight immutable remote released assets."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import gzip
from hashlib import sha256
import json
from pathlib import Path
import re
import tarfile
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

CHUNK = 1 << 20
FID = re.compile(r"OCF-[A-Z]{3}-[0-9]{3}\Z")
HEX = re.compile(r"[a-f0-9]{64}\Z")

def canonical(obj):
    return (json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()

def seal(catalog, indexes, registry, output, version, locale, voice):
    release, = [row for row in catalog["releases"] if row["version"] == version]
    sources = {}
    for function in release["functions"]:
        fid = function["function_id"]
        candidates = [a for session in function["sessions"] if session["locale"] == locale
                      and session["voice_id"] == voice for a in session["assets"] if a["format"] == "flac"]
        if candidates:
            asset, = candidates
            if not FID.fullmatch(fid):
                raise ValueError("Unexpected function identifier")
            sources["original-" + fid] = {"sha256": asset["sha256"], "bytes": asset["size_bytes"]}
    present = {p.stem for p in indexes.glob("OCF-*.json")}
    if not sources or present != {key.removeprefix("original-") for key in sources}:
        raise ValueError("An eligible published master has no matching splice index or vice versa")
    inventory = json.loads((indexes / "inventory.json").read_text())
    if any(inventory.get(k) != proof for k, proof in sources.items()):
        raise ValueError("Original master digest or size differs from the published release")
    if set(registry) != set(inventory):
        raise ValueError("Exactly one byte host entry is required for every master and shared clip")
    for name, asset in registry.items():
        url = urlsplit(asset["url"])
        if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError("Expected an immutable HTTPS media URL")
        if {k: asset[k] for k in ("bytes", "sha256")} != inventory[name]:
            raise ValueError("Media inventory differs from the verified indexes")
        if asset["bytes"] <= 0 or not HEX.fullmatch(asset["sha256"]):
            raise ValueError("Invalid asset checksum")
        if len(asset["chunks"]) != (asset["bytes"] + CHUNK - 1) // CHUNK or any(
                not HEX.fullmatch(digest) for digest in asset["chunks"]):
            raise ValueError("Missing or invalid range checksums")
    sessions = {}
    versions = set()
    for fid in sorted(present):
        session = json.loads((indexes / (fid + ".json")).read_text())
        versions.add(session["revision"])
        names = {c["control"] for c in session["checks"]}
        if not names or len(names) != len(session["checks"]):
            raise ValueError("Missing or duplicate Smart Play sections")
        for key, of in (("master", session["master"]), *((k, option["packets"])
              for c in session["checks"] for k, option in c["options"].items())):
            for asset, ptr, size, block, old in of:
                if asset == -1:
                    continue
                if asset not in registry or not 0 <= ptr < ptr + size <= registry[asset]["bytes"]:
                    raise ValueError(f"{fid} {key} references an undeclared or invalid audio range")
        sessions[fid] = dict(controls=[
            {"control": c["control"], "name": c["name"], "original": c["original"],
             "options": {key: True for key in c["options"]}} for c in session["checks"]
        ], held=session["held"])
    revision, = versions
    manifest = {"schema": 1, "edition": version, "locale": locale, "voice": voice,
                "revision": revision, "inventory": registry, "sessions": sessions, "mediaBase": "/"}
    output.mkdir(parents=True, exist_ok=True)
    file = output / "smart-play-indexes.tar.gz"
    entries = [("registry.json", canonical(manifest))]
    entries.extend((fid + ".json", (indexes / (fid + ".json")).read_bytes()) for fid in sorted(present))
    from io import BytesIO
    with file.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w|") as archive:
            for name, payload in entries:
                member = tarfile.TarInfo(name)
                member.size = len(payload)
                member.mode = 0o644
                archive.addfile(member, BytesIO(payload))
    receipt = {"session_count": len(sessions), "asset_count": len(registry), "bytes": file.stat().st_size,
               "sha256": sha256(file.read_bytes()).hexdigest(), "revision": revision, "edition": version}
    (output / "smart-play-indexes-receipt.json").write_bytes(canonical(receipt))
    (output / "registry.json").write_bytes(canonical(manifest))
    print(receipt)

def verify(registry, origin, full=False):
    def asset_probe(item):
        name, item = item
        count = len(item["chunks"])
        positions = range(count) if full else sorted({0, count // 2, count - 1})
        for n in positions:
            a, b = n * CHUNK, min((n + 1) * CHUNK, item["bytes"])
            request = Request(item["url"], headers={"Range": f"bytes={a}-{b-1}", "Origin": origin,
                                                   "Accept-Encoding": "identity"})
            with urlopen(request, timeout=30) as reply:
                if reply.geturl() != item["url"] or reply.status != 206 or reply.headers.get("Access-Control-Allow-Origin") not in ("*", origin):
                    raise ValueError(name + " does not grant verifiable browser range reads at the pinned URL")
                data = reply.read(b - a + 1)
                if len(data) != b - a or sha256(data).hexdigest() != item["chunks"][n]:
                    raise ValueError(name + " returned incorrect source bytes")
        print(name, "passed", len(positions), "ranges", flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(asset_probe, sorted(registry.items())))

def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub=p.add_subparsers(dest="op", required=True)
    b=sub.add_parser("seal")
    for key in ("catalog", "index", "registry", "output"):
        b.add_argument("--"+key, required=True, type=Path)
    b.add_argument("--edition", required=True)
    b.add_argument("--locale", default="en-US")
    b.add_argument("--voice", default="mike-original")
    v=sub.add_parser("verify-ranges")
    v.add_argument("--registry", required=True, type=Path)
    v.add_argument("--origin", default="https://ocfproject.org")
    v.add_argument("--full", action="store_true")
    a=p.parse_args()
    r=json.loads(a.registry.read_text())
    if a.op=="seal":
        seal(json.loads(a.catalog.read_text()), a.index, r, a.output, a.edition, a.locale, a.voice)
    else:
        verify(r.get("inventory",r), a.origin, a.full)

if __name__ == "__main__":
    main()
