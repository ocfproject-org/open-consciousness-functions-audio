"""Use one template and exact media manifests to deploy the six dedicated Pages projects."""
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import time

BASE = Path(__file__).resolve().parents[1] / "smart-play/media-pages"
ORG = "ocfproject-org"
SHARDS = [f"{n:02}" for n in range(1,7)]

def run(*args,cwd=None,check=True):
    return subprocess.run(args,cwd=cwd,check=check,text=True,capture_output=True)

def api(ep,*args,optional=False):
    r=run("gh","api",ep,*args,check=False)
    if r.returncode:
        if optional and "HTTP 404" in r.stderr:return None
        raise RuntimeError(r.stderr.strip())
    return json.loads(r.stdout)

def validate(entry):
    assert entry["schema"]==1 and re.fullmatch(r"v\d+\.\d+\.\d+",entry["route"])
    rows=entry["assets"]
    assert rows and sum(v["bytes"] for v in rows.values())<900000000
    for key,v in rows.items():
        assert re.fullmatch(r"[A-Za-z0-9-]+",key) and re.fullmatch(r"[a-f0-9]{64}",v["sha256"]) and v["bytes"]>0
        assert v["source"].startswith("https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/")

def deploy(shard,manifest,work):
    name="ocf-smart-play-media-"+shard
    full=f"{ORG}/{name}"; ep=f"repos/{full}"
    desc="OCF Smart Play media-only Pages shard "+shard
    repo=api(ep,optional=True)
    if repo is None:
        repo=api(f"orgs/{ORG}/repos","-X","POST","-f",f"name={name}","-f",f"description={desc}",
                 "-F","private=false","-F","has_issues=false","-F","has_wiki=false")
    assert repo["full_name"]==full and repo["description"]==desc and repo["visibility"]=="public" and not repo["archived"]
    (work/(shard+"-repo.json")).write_text(json.dumps({k:repo[k] for k in ["id","full_name","description"]}))
    print(full,repo["id"],flush=True)
    path=work/name
    if not path.exists():run("gh","repo","clone",full,str(path))
    def git(*a,check=True):return run("git",*a,cwd=path,check=check)
    assert git("remote","get-url","origin").stdout.strip() in (f"https://github.com/{full}.git",f"https://github.com/{full}",f"git@github.com:{full}.git")
    assert not git("status","--porcelain").stdout
    git("fetch","origin")
    if not git("rev-parse","--verify","origin/main",check=False).returncode:
        git("switch","main");git("merge","--ff-only","origin/main")
    else:git("symbolic-ref","HEAD","refs/heads/main")
    (path/".github/workflows").mkdir(parents=True,exist_ok=True)
    shutil.copyfile(BASE/"workflow.yml",path/".github/workflows/pages.yml")
    shutil.copyfile(BASE/"build.py",path/"build.py")
    shutil.copyfile(manifest,path/"manifest.json")
    (path/"README.md").write_text(f"# {desc}\n\nGenerated release input. No recordings or player code are committed.\n")
    git("add","--",".github/workflows/pages.yml","build.py","manifest.json","README.md")
    if git("diff","--cached","--quiet",check=False).returncode:
        git("commit","-m",f"Stage latest published Smart Play media for shard {shard}")
    git("push","-u","origin","main")
    p=api(ep+"/pages",optional=True)
    if p is None:p=api(ep+"/pages","-X","POST","-f","build_type=workflow")
    assert p["build_type"]=="workflow" and not p["cname"]
    sha=git("rev-parse","HEAD").stdout.strip()
    result=run("gh","run","list","-R",full,"--workflow","pages.yml","--commit",sha,"--limit","5","--json","status,conclusion",check=False)
    if result.returncode or not any(r["status"]!="completed" or r["conclusion"]=="success" for r in json.loads(result.stdout)):
        # GitHub can take a minute to discover the first committed workflow.
        for attempt in range(12):
            dispatched=run("gh","workflow","run","pages.yml","-R",full,"--ref","main",check=False)
            if not dispatched.returncode: break
            if "HTTP 404" not in dispatched.stderr or attempt==11:
                raise RuntimeError(dispatched.stderr.strip())
            time.sleep(5)
    (work/(shard+"-receipt.json")).write_text(json.dumps({"repo":full,"id":repo["id"],"head":sha,"url":p["html_url"]}))
    print("Dispatched or reused exact-head deployment:",full,sha,flush=True)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifests",type=Path);p.add_argument("workspace",type=Path)
    p.add_argument("--shard",choices=SHARDS,action="append")
    p.add_argument("--apply",action="store_true")
    a=p.parse_args()
    manifests={n:a.manifests/(n+".json") for n in (a.shard or SHARDS)}
    for n,file in manifests.items():
        entry=json.loads(file.read_text());validate(entry);print(n,len(entry["assets"]),sum(v["bytes"] for v in entry["assets"].values()))
    if a.apply:
        a.workspace.mkdir(parents=True,exist_ok=True)
        for n,file in manifests.items():deploy(n,file,a.workspace)

if __name__=="__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        raise SystemExit((e.stderr or e.stdout or str(e)).strip())
