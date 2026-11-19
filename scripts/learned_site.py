"""Generated, allowlisted public learning snapshots; never another source registry."""
import hashlib
import json
import re
import unicodedata


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def contract(function):
    fields = {}

    def add(key, value):
        if isinstance(value, str) and value.strip():
            fields[key] = " ".join(unicodedata.normalize("NFC", value).split())

    def reviewed(key, value):
        if isinstance(value, dict) and value.get("status") in {"canonical", "reviewed"}:
            add(key, value.get("text"))

    reviewed("description", function.get("description"))
    for command in function.get("commands", []):
        if command.get("command_status") != "active":
            continue
        prefix = "command." + command["command_id"] + "."
        for name in ("display_cue", "usage", "explanation"):
            reviewed(prefix + name, command.get(name))
        if command.get("spoken_status") in {"canonical", "reviewed"}:
            add(prefix + "spoken_cue", command.get("spoken_cue"))
        for name in ("role", "designation", "effect_scope", "procedure_status"):
            add(prefix + name, command.get(name))
        for name in ("activation", "persistence"):
            add(prefix + name, (command.get("invocation_scope") or {}).get(name))
        if command.get("procedure_status") == "documented":
            for index, step in enumerate(command.get("procedure_steps", [])):
                add(prefix + f"step.{index + 1}", step.get("instruction"))
    lifecycle = function.get("lifecycle", {})
    for name in ("activation", "persistence", "release_command"):
        add("lifecycle." + name, lifecycle.get(name))
    for index, condition in enumerate(lifecycle.get("trigger_conditions", [])):
        add(f"lifecycle.trigger.{index + 1}", condition)
    for index, scope in enumerate(lifecycle.get("scopes", [])):
        for name in ("kind", "activation", "persistence"):
            add(f"lifecycle.scope.{index + 1}.{name}", scope.get(name))
        if scope.get("description_status") in {"canonical", "reviewed"}:
            add(f"lifecycle.scope.{index + 1}.description", scope.get("description"))
    for index, note in enumerate(function.get("safety_notes", [])):
        add(f"safety.{index + 1}", note)
    return {"schema": 1, "fields": fields}


def projection(export, catalog):
    subjects = {}
    for function in export["functions"]:
        snapshot = contract(function)
        subjects[function["function_id"]] = {
            "title": function["title"]["text"],
            "guide": {"commit": export["source_commit"], "locale": export["locale"],
                      "fingerprint": hashlib.sha256(canonical(snapshot).encode()).hexdigest(),
                      "snapshot": snapshot}, "recordings": []}
    subjects["preparation:ocf"] = {"title": "OCF Preparation Learning", "guide": None, "recordings": []}
    subjects["preparation:human-plus"] = {"title": "Official Human Plus preparation (self-reported)", "guide": None, "recordings": []}
    for release in catalog["releases"]:
        for group in release["functions"] + release.get("preparations", []):
            subject = subjects.get(group.get("function_id", "preparation:ocf"))
            if subject is None:
                continue
            for session in group["sessions"]:
                assets = session.get("assets", [])
                if not assets:
                    continue
                provenance = assets[0].get("provenance", {})
                render = provenance.get("render_source")
                subject["recordings"].append({
                    "tag": release["tag"], "edition": session.get("edition", release["version"]),
                    "locale": session["locale"], "voice": session["voice_id"],
                    "source_commit": provenance.get("source_ocf_commit"),
                    "master_sha256": provenance.get("master_sha256"),
                    "render_source": {key: render.get(key) for key in ("base_commit", "state", "snapshot_sha256")} if render else None,
                    "assets": sorted([{"id": a["asset_id"], "format": a["format"], "sha256": a["sha256"]} for a in assets], key=lambda a: a["id"]),
                })
    return {"schema": 1, "subjects": subjects}


def install(staging, export, catalog):
    data = projection(export, catalog)
    target = staging / "assets/data/learning.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(canonical(data) + "\n", encoding="utf-8")
    data_version = hashlib.sha256(target.read_bytes()).hexdigest()[:16]
    for page in sorted(staging.rglob("*.html")):
        relative = page.relative_to(staging)
        if relative.as_posix() == "404.html":
            continue
        subject = relative.parts[1] if len(relative.parts) == 3 and relative.parts[0] == "functions" and relative.parts[1] in data["subjects"] else ""
        if relative.as_posix() == "preparation-learning/index.html":
            subject = "preparation:ocf"
        view = "function" if subject else {"functions/index.html": "browse", "quick-reference/index.html": "reference"}.get(relative.as_posix(), "settings")
        prefix = "../" * (len(relative.parts) - 1)
        text = page.read_text(encoding="utf-8")
        assets = (f'<link rel="stylesheet" href="{prefix}assets/css/learned.css">'
                  f'<script src="{prefix}assets/js/learned.js" defer></script>')
        text = text.replace("</head>", assets + "</head>")
        panel = (f'<section class="learned-panel" data-learned-subject="{subject}" '
                 f'data-learned-view="{view}" data-learned-src="{prefix}assets/data/learning.json?v={data_version}" aria-label="Private library actions" hidden></section>')
        # Place after the page introduction, leaving canonical guidance untouched.
        if view == "settings":
            text = text.replace("</main>", panel + "</main>", 1)
            page.write_text(text, encoding="utf-8")
            continue
        text, count = re.subn(r'(<header class="page-intro\b[^>]*>.*?</header>)',
                              lambda match: match[0] + panel, text, count=1, flags=re.S)
        if count != 1:
            raise ValueError(f"learning panel requires a page introduction: {page}")
        page.write_text(text, encoding="utf-8")
