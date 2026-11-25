"""Offline different-edition acceptance tests for the actual release tools."""
import copy
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
BUILDER = runpy.run_path(str(ROOT / "smart-play/media-pages/build.py"))
RELEASES = BUILDER["RELEASES"]


class MediaPagesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.edition = "0.4.0"
        self.tag = "smart-play-clips-0.4.0"
        self.source = self.root / "source"
        self.source.mkdir()
        self.shards = self.root / "shards"
        self.work = self.root / "deploy-work"
        inventory = {}
        self.payload = {}

        def asset(key, tag, name):
            data = b"fLaC" + key.encode()
            proof = {"bytes": len(data), "sha256": sha256(data).hexdigest()}
            inventory[key] = proof
            url = RELEASES + tag + "/" + name
            self.payload[url] = data
            (self.source / (key + ".flac")).write_bytes(data)
            return {**proof, "source": url}

        functions = []
        for n in range(1, 8):
            key = f"OCF-FND-{n:03}"
            row = asset("original-" + key, "audio-" + self.edition, key + ".flac")
            functions.append({"function_id": key, "sessions": [
                {"locale": "en-US", "voice_id": "mike-original", "assets": [{
                    "format": "flac", "size_bytes": row["bytes"], "sha256": row["sha256"],
                    "download_url": row["source"],
                }]},
            ]})
        shared = {"relaxation-short": asset("relaxation-short", self.tag, "relaxation-short.flac")}
        self.write(self.root / "catalog.json", {"releases": [{"version": self.edition, "functions": functions}]})
        self.write(self.root / "shared.json", shared)
        self.write(self.source / "inventory.json", inventory)

    @staticmethod
    def write(path, data):
        path.write_text(json.dumps(data))

    def run_script(self, name, *args, check=True):
        return subprocess.run([sys.executable, str(ROOT / "scripts" / name), *args],
                              text=True, capture_output=True, check=check)

    def plan(self, tag=None, check=True, out=None):
        return self.run_script("plan_smart_play_media_pages.py",
                               "--edition", self.edition, "--shared-release-tag", tag or self.tag,
                               "--catalog", self.root / "catalog.json", "--shared", self.root / "shared.json",
                               "--source", self.source, "--output", out or self.shards, check=check)

    def test_later_edition_runs_all_six_builders_without_deploying(self):
        self.plan()
        second = self.root / "second"
        self.plan(out=second)
        for path in self.shards.glob("*.json"):
            self.assertEqual(path.read_bytes(), (second / path.name).read_bytes())
        self.run_script("deploy_smart_play_media_pages.py", self.shards, self.work)
        self.assertFalse(self.work.exists())

        class Response(BytesIO):
            def geturl(self):
                return "https://release-assets.githubusercontent.com/fixture"

        def urlopen(request, timeout):
            return Response(self.payload[request.full_url])

        fetched = set()
        for n in range(1, 7):
            manifest = self.shards / f"{n:02}.json"
            spec = json.loads(manifest.read_text())
            target = self.root / f"media-{n}"
            with patch.object(sys, "argv", ["build.py", str(manifest), str(target)]), patch.dict(
                BUILDER["main"].__globals__, {"urlopen": urlopen}
            ):
                BUILDER["main"]()
            for key, item in spec["assets"].items():
                self.assertEqual((target / ("v" + self.edition) / (key + ".flac")).read_bytes(),
                                 self.payload[item["source"]])
                fetched.add(key)
        self.assertEqual(len(fetched), 8)

    def test_planner_refuses_unapproved_shared_tag(self):
        res = self.plan(tag="other-unapproved-release", check=False)
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("Not an approved release asset", res.stderr)
        self.assertFalse(self.shards.exists())

    def test_planner_refuses_corrupted_local_audio(self):
        (self.source / "relaxation-short.flac").write_bytes(b"not the expected asset")
        res = self.plan(check=False)
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("does not match exact published proof", res.stderr)

    def test_builder_refuses_wrong_edition_and_modified_source(self):
        self.plan()
        row = next(json.loads(p.read_text()) for p in sorted(self.shards.glob("0*.json"))
                   if "original-" in p.read_text())
        for source in [
            RELEASES + "audio-0.3.0/valid.flac",
            RELEASES + "audio-0.4.0/valid.flac?other=1",
            "https://example.org/audio-0.4.0/valid.flac",
        ]:
            with self.subTest(source=source):
                altered = copy.deepcopy(row)
                key = next(k for k in altered["assets"] if k.startswith("original-"))
                altered["assets"][key]["source"] = source
                with self.assertRaises(ValueError):
                    BUILDER["validate"](altered)

    def test_deployer_refuses_mixed_version_shards(self):
        self.plan()
        path = self.shards / "01.json"
        mixed = json.loads(path.read_text())
        mixed["route"] = "v0.5.0"
        for row in mixed["assets"].values():
            row["source"] = row["source"].replace("audio-0.4.0/", "audio-0.5.0/")
        self.write(path, mixed)
        res = self.run_script("deploy_smart_play_media_pages.py", self.shards, self.work, check=False)
        self.assertIn("Shard set must use one edition", res.stderr)
        self.assertFalse(self.work.exists())


if __name__ == "__main__":
    unittest.main()
