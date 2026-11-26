"""Static research and learning pages, kept separate from canonical recording guides."""
from datetime import datetime
from html import escape
import json
import re
from urllib.parse import urlsplit

PAGES = (
    ("learn", "Learn"),
    ("learn/glossary", "Full glossary"),
    ("learn/faq", "Concept FAQ"),
    ("learn/sources", "Source directory"),
    ("learn/history/miranon", "Miranon historical appendix"),
)
SECTIONS = {
    "concepts": ("learn/glossary", "Glossary term"),
    "faq": ("learn/faq", "Question"),
    "practical_tips": ("learn/faq", "Practice tip"),
    "miranon_levels": ("learn/history/miranon", "Historical entry"),
    "sources": ("learn/sources", "Source"),
}
CORE_LINKS = {
    "rebal": "functions/OCF-EXP-007/",
    "energy-ball-deflate": "functions/OCF-EXP-007/",
    "energy-ball-inflate": "functions/OCF-EXP-007/",
    "rebal-ocf-traditional": "functions/OCF-EXP-007/",
    "deflate-ending": "functions/OCF-EXP-007/",
    "inflate-again": "functions/OCF-EXP-007/",
    "exact-cue": "quick-reference/",
    "historical-name": "historical-names/",
}
GUIDE_ANSWERS = {
    "headphones": "stereo-test",
    "bluetooth": "stereo-test",
    "mono": "stereo-test",
    "volume": "volume",
    "flac": "players-and-playback-settings",
    "smart-downloads": "smart-play",
    "smart-options": "smart-play",
    "smart-skip": "smart-play",
}
RETRIEVAL = {
    "search_excerpt": "Excerpt only",
    "page_text": "Page text reviewed",
    "page_and_comments": "Page and comments reviewed",



    "editorial": "Editorial synthesis",

}
REJECTED = re.compile(r"32066611|PMC7082494|Orozco.?Perez|ENEURO\.0232-19\.2020", re.I)

def h(value):
    return escape(str(value), quote=True)

def blurb(text):
    return "".join(f"<p>{h(p)}</p>" for p in re.split(r"\n\s*\n", text or "") if p.strip())

def anchor(route, ident=None):
    return route + "/" + (f"#{ident}" if ident else "")

def local_link(url, base):
    p = urlsplit(url or "")
    if p.scheme not in {"http", "https"} or not p.hostname or p.username or p.password:
        return None
    if p.hostname == "ocfproject.org":
        return base + p.path.lstrip("/") + (f"?{p.query}" if p.query else "") + (f"#{p.fragment}" if p.fragment else "")
    return url

def validate(data):
    if data["schema_version"] != 2 or REJECTED.search(json.dumps(data)):
        raise ValueError("Unsupported knowledge-base version or excluded citation")
    keys = {k: {r["id"]: r for r in data[k]} for k in SECTIONS}
    for section, rows in keys.items():
        if len(rows) != len(data[section]):
            raise ValueError("Duplicate knowledge-base ID in " + section)
        if any(not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", ident) for ident in rows):
            raise ValueError("Invalid knowledge-base ID in " + section)
    aliases = data["source_aliases"]
    if set(aliases) & set(keys["sources"]) or not set(aliases.values()) <= keys["sources"].keys():
        raise ValueError("Invalid source alias")
    for k, rows in keys.items():
        for r in rows.values():
            if any(t not in keys["concepts"] for t in r.get("related", [])):
                raise ValueError(f"Missing related concept for {r['id']}")
            for ref in r.get("sources", []):
                s = ref["source_id"]
                if aliases.get(s, s) not in keys["sources"]:
                    raise ValueError(f"Missing source {s} for {r['id']}")
    return keys

def visitor_data(data_path):
    """Load the reviewed, public-only Learn content."""
    data = json.loads(data_path.read_text(encoding="utf-8"))
    validate(data)
    return data


def directory(data_path, *, smart_play):
    data = visitor_data(data_path)
    keys = validate(data)
    concepts = keys["concepts"]
    aliases = data["source_aliases"]
    pages = {}
    def route_nav(current, base):
        return '<nav class="learn-nav" aria-label="Learn pages">' + "".join(
            f'<a href="{base}{anchor(route)}"{(" aria-current=page" if current == route else "")}>{h(title)}</a>'
            for route, title in PAGES
        ) + "</nav>"
    def intro(route, title, desc, base):
        return f'<header class="page-intro"><h1>{h(title)}</h1><p>{h(desc)}</p></header>' + route_nav(route, base)
    def refs(rec, base):
        related = "".join(f'<li><a href="{base}{anchor("learn/glossary", c)}">{h(concepts[c]["title"])}</a></li>'
                          for c in rec.get("related", []) if c in concepts and c != rec["id"])
        cites = []
        for ref in rec.get("sources", []):
            ident = aliases.get(ref["source_id"], ref["source_id"])
            title = keys["sources"][ident]["title"]
            loc = f' · {h(ref["locator"])}' if ref.get("locator") else ""
            cites.append(f'<li><a href="{base}{anchor("learn/sources", ident)}">{h(title)}</a>{loc}</li>')
        rel = f'<p>Related concepts</p><ul>{related}</ul>' if related else ""
        evidence = '<details class="learn-evidence"><summary>Sources and notes</summary><ul>' + "".join(cites) + '</ul></details>' if cites else ""
        return rel + evidence
    def source_body(rec, base):
        links = {}
        def add(label, value):
            url = local_link(value, base)
            if url and url not in links:
                links[url] = label
        for name in ("preferred_read_url", "document_url", "text_url"):
            label = "Public full text"
            if name == "preferred_read_url" and rec.get("id") == "APH":
                label = "Publisher reading route (full text not verified)"
            add(label, rec.get(name))
        if not rec.get("hide_original_access"):
            add("Original", rec.get("original_url") or rec.get("url"))
        for alt in rec.get("accessible_alternatives") or []:
            add(alt.get("label") or "Public alternative", alt.get("url"))
        status = rec.get("archive_status")
        if status == "capture_available":
            date = datetime.strptime(rec["capture_timestamp"], "%Y%m%d%H%M%S").date().isoformat()
            add(f"Wayback: {date} · Capture available; content not checked", rec.get("archive_url"))
        elif status in ("no_capture_reported", "lookup_only"):
            add("Wayback: Browse captures", rec.get("wayback_lookup_url"))
        routes = "".join(f'<li><a href="{h(url)}">{h(label)}</a></li>' for url, label in links.items())
        if routes:
            routes = "<ul>" + routes + "</ul>"
        elif rec.get("source_type") == "uploaded":
            routes = "<p>No public link is established for this exact reference.</p>"
        access = RETRIEVAL.get(rec.get("retrieval"))
        meta = f"<p>{h(access)}</p>" if access else ""
        if status == "archival_repository":
            meta += "<p>Original held in an archive; not a Wayback capture.</p>"
        return blurb(rec.get("summary") or rec.get("note")) + meta + routes
    def row(kind, rec, base):
        ident = rec["id"]
        title = rec.get("title") or rec.get("question") or f"Focus {rec['number']}: {rec['color']}"
        category = rec.get("category") or (rec["kind"] if kind == "sources" else rec.get("color", "Practice tips"))
        type_label = SECTIONS[kind][1]
        label = rec.get("classification") or (rec.get("provenance_layer") if kind == "miranon_levels" else None) or category
        aliases_text = " ".join(rec.get("aliases", []))
        if kind == "concepts":
            body = blurb(rec["definition"]) + blurb(rec.get("practice"))
        elif kind == "faq":
            guide = GUIDE_ANSWERS.get(ident)
            if guide:
                if guide == "smart-play" and not smart_play:
                    guide = "players-and-playback-settings"
                body = f'<p><a href="{base}listening/#{guide}">Read the current answer in the Listening Guide</a>.</p>'
            else:
                body = blurb(rec["answer"])
        elif kind == "practical_tips":
            body = blurb(rec["text"])
        elif kind == "miranon_levels":
            body = blurb(rec.get("theme")) + blurb(rec["description"]) + blurb(rec["provenance_layer"])
        else:
            body = source_body(rec, base)
            aliases_text += " " + ident + " " + " ".join(a for a, target in aliases.items() if ident == target)
        if aliases_text.strip() and kind == "concepts":
            body += f'<p class="learn-aliases">Also called: {h(", ".join(rec["aliases"]))}</p>'
        if ident in CORE_LINKS:
            body += f'<p><a href="{base}{CORE_LINKS[ident]}">Open the current OCF guide</a></p>'
        if ident in {"transmutation-box", "box-contents"}:
            body += (f'<p>Function guides: <a href="{base}functions/OCF-EMO-001/">Plus Let Go</a>'
                     f' · <a href="{base}functions/OCF-EMO-002/">Plus Offload</a></p>')
        body += refs(rec, base)
        # Rendered content is indexed by the browser; only extra lookup aliases need an attribute.
        search_text = aliases_text + f" {title} {label} {ident.replace('-', ' ')}"
        if kind == "faq" and (guide := GUIDE_ANSWERS.get(ident)):
            search_text += " " + guide.replace("-", " ")
            if guide == "smart-play":
                search_text += " original recording full guidance shorter guidance custom downloads captions"
        alias_anchors = "".join(f'<span id="{h(a)}"></span>' for a, target in aliases.items() if kind == "sources" and ident == target)
        return category, type_label, (f'<section class="learn-row guide-section" id="{h(ident)}" data-category="{h(category)}" '
            f'data-type="{h(type_label)}" data-search="{h(search_text)}">{alias_anchors}<details data-learn-entry>'
            f'<summary><span>{h(title)}</span><small>{h(label)}</small></summary>'
            f'<p class="learn-permalink"><a href="#{h(ident)}">Link to this entry</a></p>{body}</details></section>')
    def searchable(route, title, desc, groups, base):
        rows = [row(key, rec, base) for key, elements in groups for rec in elements]
        def options(values):
            return "".join(f'<option value="{h(v)}">{h(v)}</option>' for v in sorted(set(values), key=str.casefold))
        controls = f'''<form class="learn-controls" data-learn-controls hidden role="search">
            <label>Search {h(title.lower())}<input type="search" data-learn-query placeholder="Search words or phrases"></label>
            <label>Category<select data-learn-category><option value="">All categories</option>{options(x[0] for x in rows)}</select></label>
            <label>Content type<select data-learn-type><option value="">All content types</option>{options(x[1] for x in rows)}</select></label>
            <button type="reset">Reset</button></form>
            <p role="status" data-learn-status>{len(rows)} entries</p>
            <p data-learn-empty hidden>No entries match. Try another search or reset the filters.</p>'''
        return intro(route, title, desc, base) + f'<div data-learn-directory>{controls}'+ "".join(r[2] for r in rows) + "</div>"
    b = "../"
    start = data["start_here"]
    landing = intro("learn", "Learn", "Look up a term, find answers about practice, or trace an idea to its sources.", b)
    landing += '<section class="guide-section"><h2>' + h(start["title"]) + '</h2>' + blurb(start["text"])
    landing += '<ul>' + "".join(f'<li><a href="{h(local_link(x["url"], b))}">{h(x["title"])}</a></li>' for x in start["links"])
    landing += '<li><a href="../historical-names/">Historical Names</a></li><li><a href="../how-it-works/#what-a-typical-function-session-looks-like">What a typical session looks like</a></li></ul></section>'
    landing += '<section class="guide-section"><h2>Explore the knowledge base</h2><ul>' + "".join(
        f'<li><a href="{b}{anchor(route)}">{h(title)}</a> · {n} {unit}</li>'
        for (route, title), n, unit in zip(PAGES[1:], (len(concepts), len(data["faq"])+len(data["practical_tips"]), len(data["sources"]), len(data["miranon_levels"])), ("terms", "questions and tips", "source records", "attributed historical entries"))
    ) + '</ul><p><a href="../glossary/">Read the quick Glossary and FAQ</a> for common OCF session terms.</p></section>'
    pages["learn"] = landing
    pages["learn/glossary"] = searchable("learn/glossary", "Glossary", "OCF practices, Monroe terminology, and related ways people describe their experiences.", [("concepts", concepts.values())], "../../")
    pages["learn/faq"] = searchable("learn/faq", "Concept FAQ", "Questions about the practices and what you may notice. Use the Listening Guide for current playback instructions.", [("faq", data["faq"]), ("practical_tips", data["practical_tips"])], "../../")
    pages["learn/sources"] = searchable("learn/sources", "Source directory", "What each source covers, how it was checked, and where you can read or look for it.", [("sources", data["sources"])], "../../")
    pages["learn/history/miranon"] = searchable("learn/history/miranon", "Miranon historical appendix", "A separate account of the levels in the Erickson compilation, attributed to its source layers. It does not use the same numbering as the current OCF session instructions.", [("miranon_levels", data["miranon_levels"])], "../../../")
    return pages
