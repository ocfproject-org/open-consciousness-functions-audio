"""Build a static media artifact from exact previously public GitHub release files."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
import re,sys
from urllib.parse import urlsplit
from urllib.request import urlopen,Request

RELEASES = "https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/"
EDITION = r"[0-9]+\.[0-9]+\.[0-9]+"
SAFE_TOKEN = r"[A-Za-z0-9][A-Za-z0-9._-]*"
ASSET_NAME = r"[A-Za-z0-9-]+"

def validate_source(key, row, edition, shared_tags):
    url = row["source"]
    if not url.startswith(RELEASES):
        raise ValueError("Not the approved source repository")
    expected = {"audio-" + edition} if key.startswith("original-") else shared_tags
    tail = url[len(RELEASES):]
    tag, sep, asset = tail.partition("/")
    if not sep or tag not in expected or not re.fullmatch(SAFE_TOKEN, asset) or not asset.endswith(".flac"):
        raise ValueError("Not an approved release asset: " + key)
    if type(row["bytes"]) is not int or row["bytes"] <= 0 or not re.fullmatch(r"[a-f0-9]{64}", row["sha256"]):
        raise ValueError("Missing exact byte-count or SHA-256: " + key)

def validate_tags(tags):
    if not isinstance(tags, list) or not tags or any(
        not isinstance(tag, str) or not re.fullmatch(SAFE_TOKEN, tag) or tag.startswith("audio-")
        for tag in tags
    ) or len(set(tags)) != len(tags):
        raise ValueError("Specify distinct, exact approved shared-clip release tags")

def validate(cfg):
    if cfg["schema"] != 2 or not re.fullmatch("v" + EDITION, cfg["route"]):
        raise ValueError("Invalid shard manifest schema or route")
    validate_tags(cfg["shared_release_tags"])
    tags = set(cfg["shared_release_tags"])
    rows = cfg["assets"]
    if not rows:
        raise ValueError("Shard has no assets")
    for key, row in rows.items():
        if not re.fullmatch(ASSET_NAME, key):
            raise ValueError("Invalid filename")
        validate_source(key, row, cfg["route"][1:], tags)
    if sum(row["bytes"] for row in rows.values()) >= 900_000_000:
        raise ValueError("Shard exceeds local headroom threshold")

def main():
    source,output=map(Path,sys.argv[1:3]); cfg=json.loads(source.read_text())
    validate(cfg)
    out=output/cfg['route'];out.mkdir(parents=True)
    (output/'index.html').write_text('<!doctype html><title>OCF public Smart Play media</title>'
        '<meta name="robots" content="noindex,nofollow,noarchive"><p>Files for the public OCF player.</p>')
    def get(item):
        name,row=item
        url=row['source']
        fn=out/(name+'.flac'); digest=sha256(); total=0
        with urlopen(Request(url,headers={'User-Agent':'ocf-public-pages-media'}),timeout=45) as src, fn.open('xb') as dest:
            if urlsplit(src.geturl()).netloc not in {'github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'}:
                raise ValueError('Unexpected audio redirect')
            remaining=row['bytes']
            while remaining:
                data=src.read(min(remaining,1<<20))
                if not data:raise ValueError('Incomplete public asset '+name)
                remaining-=len(data);digest.update(data);dest.write(data);total+=len(data)
            if src.read(1):raise ValueError('Public asset too long '+name)
        if total != row['bytes'] or digest.hexdigest() != row['sha256']:
            raise ValueError('Public asset does not match exact proof: '+name)
        print(name,total,'verified',flush=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(get,sorted(cfg['assets'].items())))

if __name__=='__main__':
    main()
