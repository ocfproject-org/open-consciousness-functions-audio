"""Load one pinned public Smart Play companion and stage it into a site build."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import re
import tarfile
from tempfile import TemporaryDirectory
from urllib.request import Request, urlopen

from stage_public_smart_play import stage
from seal_smart_play_catalog import FID

BASE = "https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/"
ASSET = "smart-play-indexes.tar.gz"
MAX_SIZE = 125_000_000


def stage_pinned(site, spec, bundle=None):
    edition, tag = spec["edition"], spec["tag"]
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", edition) or tag != "smart-play-release-" + edition:
        raise ValueError("Invalid production Smart Play companion identity")
    if not 0 < spec["bytes"] < MAX_SIZE or not re.fullmatch("[a-f0-9]{64}", spec["sha256"]):
        raise ValueError("Invalid pinned companion proof")
    with TemporaryDirectory() as tmp:
        indexes = Path(tmp)
        pinned = bundle or indexes / ASSET
        if bundle is None:
            url = BASE + tag + "/" + ASSET
            with urlopen(Request(url, headers={"User-Agent": "ocf-pages-build"}), timeout=90) as source:
                pinned.write_bytes(source.read(spec["bytes"] + 1))
        if pinned.stat().st_size != spec["bytes"] or sha256(pinned.read_bytes()).hexdigest() != spec["sha256"]:
            raise ValueError("Published Smart Play bundle does not match the pinned receipt")
        with tarfile.open(pinned, "r:gz") as archive:
            names = set()
            for item in archive:
                if not item.isfile() or item.name in names or not (
                    item.name == "registry.json" or
                    (item.name.endswith(".json") and FID.fullmatch(item.name[:-5]))
                ) or not 0 < item.size < 12_000_000:
                    raise ValueError("Unexpected or oversized Smart Play archive member")
                names.add(item.name)
                (indexes / item.name).write_bytes(archive.extractfile(item).read())
        registry = json.loads((indexes / "registry.json").read_text())
        if (registry["schema"], registry["edition"], registry["locale"], registry["voice"]) != (
            1, edition, spec["locale"], spec["voice"]
        ) or names != {"registry.json", *(key+".json" for key in registry["sessions"])}:
            raise ValueError("Smart Play companion schema, scope or session set did not match pin")
        if len(registry["sessions"]) != spec["session_count"] or len(registry["inventory"]) != spec["asset_count"]:
            raise ValueError("Smart Play companion counts did not match pin")
        inventory = {k:{field:v[field] for field in ("sha256", "bytes")} for k,v in registry["inventory"].items()}
        (indexes / "inventory.json").write_text(json.dumps(inventory))
        media = indexes / "media.json"
        media.write_text(json.dumps(registry["inventory"]))
        stage(site, indexes, media, edition, spec["locale"], spec["voice"])


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--site", required=True, type=Path)
    p.add_argument("--pin", type=Path, default=Path("smart-play/public-release.json"))
    p.add_argument("--bundle", type=Path, help="Offline use of the same SHA-pinned bundle")
    a = p.parse_args()
    if a.pin.is_file():
        stage_pinned(a.site, json.loads(a.pin.read_text()), a.bundle)
    elif a.bundle:
        p.error("An offline bundle requires its pin")


if __name__ == "__main__":
    main()
