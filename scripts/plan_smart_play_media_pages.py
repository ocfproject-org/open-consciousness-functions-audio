"""Build six balanced immutable Pages manifests from the verified latest audio release."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

RELEASES = "https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/"
PAGES = "https://ocfproject-org.github.io/ocf-smart-play-media-"
CHUNK = 1 << 20

def dump(path, data):
    path.write_text(json.dumps(data, sort_keys=True, indent=2) + "\n")

def read(path):
    return json.loads(path.read_text())

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for opt in ("catalog","shared","source","output"):
        p.add_argument("--"+opt,required=True,type=Path)
    p.add_argument("--edition",required=True)
    p.add_argument("--locale",default="en-US")
    p.add_argument("--voice",default="mike-original")
    a=p.parse_args()
    if not re.fullmatch(r"\d+\.\d+\.\d+",a.edition):
        raise ValueError("Invalid published edition")
    release,=[r for r in read(a.catalog)["releases"] if r["version"]==a.edition]
    inventory=read(a.source/"inventory.json")
    names={}
    for function in release["functions"]:
        key="original-"+function["function_id"]
        candidates=[item for s in function["sessions"] if s["locale"]==a.locale
                    and s["voice_id"]==a.voice for item in s["assets"] if item["format"]=="flac"]
        if candidates:
            item,=candidates
            names[key]={"bytes":item["size_bytes"],"sha256":item["sha256"],"source":item["download_url"]}
    for key,val in read(a.shared).items():
        if key.startswith("original-") or key in names:
            raise ValueError("Shared clip may not overwrite a released master")
        names[key]=val
    if not names or names.keys()!=inventory.keys():
        raise ValueError("Public source manifest does not match the verified inventory")
    groups=[{"schema":1,"route":"v"+a.edition,"assets":{}} for _ in range(6)]
    totals=[0]*6
    registry={}
    for key,row in sorted(names.items(),key=lambda kv:(-kv[1]["bytes"],kv[0])):
        if not re.fullmatch(r"[A-Za-z0-9-]+",key) or not row["source"].startswith(RELEASES):
            raise ValueError("Unexpected released asset")
        endpoint=urlsplit(row["source"])
        if endpoint.query or endpoint.fragment:
            raise ValueError("Expected a stable release URL")
        size,digest=row["bytes"],row["sha256"]
        if inventory[key]!={"bytes":size,"sha256":digest}:
            raise ValueError("Published bytes do not match the verified inventory: "+key)
        shard=min(range(6),key=totals.__getitem__)
        totals[shard]+=size
        groups[shard]["assets"][key]=row
        r=registry[key]={"bytes":size,"sha256":digest,"chunks":[],
                         "url":f"{PAGES}{shard+1:02}/v{a.edition}/{key}.flac"}
        total=0; h=sha256()
        with (a.source/(key+".flac")).open("rb") as f:
            while data:=f.read(CHUNK):
                total+=len(data);h.update(data);r["chunks"].append(sha256(data).hexdigest())
        if total!=size or h.hexdigest()!=digest:
            raise ValueError("Local audio does not match exact published proof: "+key)
    if any(n>=900000000 for n in totals):
        raise ValueError("Latest alone does not fit the six hosts; do not deploy")
    a.output.mkdir(parents=True,exist_ok=True)
    for i,manifest in enumerate(groups,1):
        dump(a.output/f"{i:02}.json",manifest)
    dump(a.output/"media-registry.json",registry)
    print(len(registry),"assets in six shards:",totals)

if __name__=="__main__":
    main()
