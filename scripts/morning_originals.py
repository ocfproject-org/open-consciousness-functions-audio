"""Reviewed concise My Morning facts; never infer cues from current OCF aliases."""

import hashlib
import json
import re
from pathlib import Path

START = "// BEGIN REVIEWED ORIGINALS\n"
END = "// END REVIEWED ORIGINALS"
ARCHIVES = [
    "https://archive.org/stream/hfunction-exercises-complete-booklet/%20Human%20Plus%20Function%20Exercises%20-%20Complete%20Booklet_djvu.txt",
    "https://archive.org/stream/function-off-loading/Off-Loading_djvu.txt",
]
CONTEXT_ROLES = {
    "OCF-CMD-FND-006-PRIMARY": "standalone-release",
    "OCF-CMD-COG-003-CLOSED": "close",
    "OCF-CMD-BOD-015-LEGACY-02": "release",
    "OCF-CMD-COG-004-RECALL": "retrieval",
    "OCF-CMD-EXP-002-CANCEL": "cancel",
}
ROLES = {
    "historical-function-or-mode": "Historical function / mode",
    "standalone-release": "Standalone release",
    "close": "Close",
    "release": "Short Fix release",
    "retrieval": "Retrieval",
    "cancel": "Cancel",
}


def require(value, message):
    if not value:
        raise ValueError("My Morning originals: " + message)


def load_catalog():
    return json.loads(
        Path(__file__).with_name("morning_originals.json").read_text(encoding="utf-8")
    )


def catalog_script(doc):
    lines = [START.rstrip(), "const historical=Object.freeze({"]
    for row in doc["rows"]:
        repo = (
            "https://github.com/ocfproject-org/open-consciousness-functions/blob/"
            + doc["source_commit"]
            + "/locales/en-US/"
            + row["repo_file"]
        )
        index = row["archive_source_index"]
        archive = index is not None
        entry = {
            "title": row["title"],
            "text": row["text"],
            "notation": row["notation"],
            "role": row["role"],
            "roleLabel": ROLES[row["role"]],
            "legacyCommand": row["legacy_command_id"],
            "repoSource": repo,
            "source": doc["sources"][index] if archive else repo,
            "evidence": "archive-command" if archive else "project-recorded",
            "evidenceLabel": "Archive command corroborated"
            if archive
            else "Project-recorded",
            "reference": (row["archive_locator"] + " · " if archive else "")
            + row["legacy_command_id"]
            + " · record_metadata.legacy",
        }
        lines.append(
            " "
            + json.dumps(row["id"])
            + ":Object.freeze("
            + json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
            + "),"
        )
    return "\n".join(lines + ["});", END])


def validate_catalog(doc, functions, source_root, source_commit):
    """Resolve only guide-receipt-listed resources, then verify exact legacy pairs."""
    import yaml

    require(
        doc.get("schema_version") == 1 and type(doc["schema_version"]) is int,
        "unsupported review schema",
    )
    require(
        doc.get("source_commit") == source_commit, "review does not match pinned source"
    )
    require(doc.get("sources") == ARCHIVES, "unreviewed archive source")
    functions = {f["canonical_resource"]: f for f in functions}
    resources, seen, pairs = {}, set(), set()
    require(
        len(doc["rows"]) == 65 and len({r["title"] for r in doc["rows"]}) == 55,
        "reviewed coverage changed",
    )
    for row in doc["rows"]:
        require(
            set(row)
            == {
                "id",
                "legacy_command_id",
                "title",
                "notation",
                "text",
                "role",
                "repo_file",
                "archive_source_index",
                "archive_locator",
            },
            "unexpected review fields",
        )
        require(
            all(
                isinstance(row[k], str)
                and row[k].strip()
                and not re.search(r"[\x00-\x1f\x7f]", row[k])
                for k in (
                    "id",
                    "legacy_command_id",
                    "title",
                    "notation",
                    "text",
                    "role",
                    "repo_file",
                )
            ),
            "invalid fact text",
        )
        require(
            re.fullmatch(r"hplus-[a-z0-9-]+", row["id"]) and row["id"] not in seen,
            "duplicate/invalid original identity",
        )
        seen.add(row["id"])
        require(
            row["role"]
            == CONTEXT_ROLES.get(
                row["legacy_command_id"], "historical-function-or-mode"
            ),
            "unreviewed role/context",
        )
        index = row["archive_source_index"]
        require(
            (index is None and row["archive_locator"] is None)
            or (
                type(index) is int
                and 0 <= index < len(doc["sources"])
                and re.fullmatch(r"OCR line [0-9]+", row["archive_locator"] or "")
            ),
            "invalid archive locator",
        )
        require(
            re.fullmatch(
                r"OCF-[A-Z]{3}-[0-9]{3}-[A-Za-z0-9-]+\.yaml", row["repo_file"]
            ),
            "unsafe resource",
        )
        resource = "locales/en-US/" + row["repo_file"]
        require(resource in functions, "resource absent from guide receipt")
        function = functions[resource]
        if resource not in resources:
            path = Path(source_root) / resource
            require(
                path.resolve().is_relative_to(Path(source_root).resolve())
                and path.is_file()
                and not any(p.is_symlink() for p in (path, *path.parents)),
                "missing/symlink resource",
            )
            raw = path.read_bytes()
            require(
                hashlib.sha256(raw).hexdigest()
                == function["canonical_resource_sha256"],
                "resource hash mismatch",
            )
            record = yaml.safe_load(raw)
            require(
                record.get("function_id") == function["function_id"],
                "resource identity mismatch",
            )
            legacy = record.get("record_metadata", {}).get("legacy", {})
            require(
                legacy.get("source_system") == "Monroe H-PLUS"
                and isinstance(legacy.get("name"), str),
                "wrong legacy source",
            )
            require(
                isinstance(legacy.get("commands"), list)
                and isinstance(legacy.get("command_ids"), list)
                and len(legacy["commands"]) == len(legacy["command_ids"]),
                "invalid typed legacy commands",
            )
            resources[resource] = legacy
        legacy = resources[resource]
        pair = (row["legacy_command_id"], row["notation"])
        require(
            pair not in pairs
            and pair in list(zip(legacy["command_ids"], legacy["commands"])),
            "cue differs from pinned legacy identity/notation",
        )
        pairs.add(pair)
    expected = {
        (cid, cue)
        for legacy in resources.values()
        for cid, cue in zip(legacy["command_ids"], legacy["commands"])
    }
    require(pairs == expected, "incomplete reviewed command coverage")
    require(
        sum(r["archive_source_index"] is not None for r in doc["rows"]) == 12,
        "archive grade coverage changed",
    )
    original = {r["id"]: r["text"] for r in doc["rows"]}
    require(
        original.get("hplus-attention-booklet") == "Plus Focus"
        and original.get("hplus-off-loading-1988") == "Plus Fade Fade",
        "stored legacy identity/text changed",
    )
    return doc


def verify_build(functions, source_root, source_commit, site_root):
    doc = validate_catalog(load_catalog(), functions, source_root, source_commit)
    script = (Path(site_root) / "assets/js/morning-state.js").read_text(
        encoding="utf-8"
    )
    require(
        script.count(START) == 1 and script.count(END) == 1,
        "missing generated catalog boundaries",
    )
    actual = START + script.split(START, 1)[1].split(END, 1)[0] + END
    require(
        actual == catalog_script(doc),
        "model catalog differs from reviewed facts; regenerate the marked block",
    )
