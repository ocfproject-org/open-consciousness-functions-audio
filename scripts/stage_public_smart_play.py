"""Stage the regular Smart Play player from the pinned planner and media receipt."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
from posixpath import relpath

CODE=Path(__file__).resolve().parents[1]/'smart-play'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(path,text):
    # Staging uses a hard-linked baseline. Never edit an original by following the link.
    temp=path.with_suffix(path.suffix+'.new')
    temp.write_text(text,encoding='utf-8')
    temp.replace(path)

def replace(s,a,b):
    if s.count(a)!=1: raise ValueError("Public integration point changed: "+a)
    return s.replace(a,b,1)

def stage(site,index,media_registry,edition,locale,voice):
    inventory=json.loads((index/'inventory.json').read_text())
    published=json.loads(media_registry.read_text())
    if set(published)!=set(inventory):raise ValueError('Missing media or incorrect media inventory')
    for key,proof in published.items():
        if {k:proof[k] for k in ('sha256','bytes')}!=inventory[key]:raise ValueError('Manifest media mismatch: '+key)
    release=next(r for r in json.loads((site/'catalog.json').read_text())['releases'] if r['version']==edition)
    sessions={}
    options={}
    modules=site/'assets/js/smart-play'
    assets=site/'assets/data/smart-play'
    modules.mkdir(parents=True);assets.mkdir(parents=True)
    revisions=set()
    for source in sorted(index.glob('OCF-*.json')):
        fid=source.stem
        [match]=[a for f in release['functions'] if f['function_id']==fid for s in f['sessions']
                 if s['locale']==locale and s['voice_id']==voice for a in s['assets'] if a['format']=='flac']
        assert inventory['original-'+fid]=={'bytes':match['size_bytes'],'sha256':match['sha256']}
        conf=json.loads(source.read_text());revisions.add(conf['revision'])
        controls=[]
        for row in conf['checks']:
            controls.append({k:row[k] for k in ('control','name','original')}|
                            {'options':{k:True for k in row['options']}})
            rule=options.setdefault(row['control'],[row['name']])
            rule.extend(k for k in row['options'] if k not in rule)
        sessions[fid]={'controls':controls,'held':conf['held']}
        shutil.copyfile(source,assets/source.name)
    expected={f['function_id'] for f in release['functions'] if any(
        s['locale']==locale and s['voice_id']==voice and any(a['format']=='flac' for a in s['assets'])
        for s in f['sessions'])}
    if not expected or sessions.keys()!=expected:
        raise ValueError('Smart Play does not cover the exact released locale and voice')
    [revision]=list(revisions)
    registry={'revision':revision,'inventory':published,'mediaBase':'/','sessions':sessions}
    (assets/'registry.json').write_text(json.dumps(registry,separators=(',',':')),encoding='utf-8')
    for name in ('compose.mjs','virtual-flac.mjs','bootstrap.js','player.js','smart-player.css'):
        shutil.copyfile(CODE/name,modules/name)
    p=modules/'player.js'
    s=re.sub(r"  const catalog=.*?;\n","  const catalog="+json.dumps(options,separators=(',',':'))+";\n",p.read_text(),count=1)
    write(p,s)
    worker=site/'ocf-smart-worker.mjs'
    shutil.copyfile(CODE/worker.name,worker)
    worker_rev=hashlib.sha256(b''.join(p.read_bytes() for p in (worker,modules/'virtual-flac.mjs',modules/'compose.mjs',assets/'registry.json'))).hexdigest()[:16]
    play=site/'assets/js/playback-controls.js'
    mark="    return players.get(audio);\n  }"
    s=replace(play.read_text(),mark,"    if (audio.dataset.localSmart) document.dispatchEvent(new CustomEvent('ocf-smart-player-registered',{detail:audio}));\n"+mark)
    write(play,s)
    ed=site/'assets/js/editions.js'
    mark="    document.querySelectorAll('audio[data-format-sources]').forEach(player => {"
    write(ed,replace(ed.read_text(),mark,mark+"\n      if (player.dataset.localSmartActive) return;"))
    app=site/'assets/js/app.js'
    mark="      player.dataset.sessionLocale = item.locale;"
    write(app,replace(app.read_text(),mark,mark+f"""
      if (item.edition==={json.dumps(edition)} && item.locale==={json.dumps(locale)}
          && item.voiceId==={json.dumps(voice)} && window.ocfPublicSmartEligible?.has(item.id))
        player.dataset.localSmart=item.id;"""))
    # This is only a shipped set of app identities, not a fallback audio manifest.
    boot=modules/'bootstrap.js'
    mark=" const manager=navigator.serviceWorker;"
    write(boot,replace(boot.read_text(),mark," window.ocfPublicSmartEligible=new Set("+json.dumps(sorted(sessions))+");\n"+mark))
    pubPath='assets/js/smart-play/'
    edition_key = '030' if edition == '0.3.0' else edition.replace('.', '-')
    session_pages = {site/'functions'/fid/'index.html': fid for fid in sessions}
    for page in site.rglob('*.html'):
        if 'experiments' in page.relative_to(site).parts:
            continue
        src = page.read_text()
        if page in session_pages:
            fid = session_pages[page]
            src,n=re.subn(rf'<audio [^>]*\bdata-session-edition="{re.escape(edition)}"[^>]*>',
                          lambda m:m[0][:-1]+f' data-local-smart="{fid}">',src)
            if n!=1:raise ValueError('No exact player: '+fid)
        if 'id="preferences"' not in src:
            if page in session_pages or page == site/'functions/index.html':
                raise ValueError('No main preferences dialog in ' + str(page.relative_to(site)))
            continue
        script=lambda name:relpath(pubPath+name,page.parent.relative_to(site).as_posix())+'?v='+sha(modules/name)[:16]
        inserts=(f'<link rel="stylesheet" href="{script("smart-player.css")}">'
           f'<script src="{script("bootstrap.js")}" data-ocf-smart-play data-service-worker="/{worker.name}?v={worker_rev}" data-session-key-edition="{edition_key}" defer></script>'
           f'<script src="{script("player.js")}" defer></script>')
        mark='<meta charset="utf-8">'
        src=replace(src,mark,mark+inserts)
        write(page,src)
    # Bump cache identity anywhere baseline controllers changed, including ordinary pages.
    for p in site.rglob('*.html'):
        if 'experiments' in p.relative_to(site).parts:continue
        s=p.read_text();n=s
        for a in (app,ed,play):
            n=re.sub(r'(/assets/js/'+re.escape(a.name)+r'\?v=)[0-9a-f]+',
                     lambda m:m[1]+sha(a)[:16],n)
        if n!=s:write(p,n)
    receipt=site/'site-build-receipt.json'
    data=json.loads(receipt.read_text())
    files={p.relative_to(site).as_posix():sha(p) for p in site.rglob('*') if p.is_file() and p!=receipt}
    data['file_count']=len(files)
    data['site_inventory_sha256']=hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    write(receipt,json.dumps(data,sort_keys=True,indent=2)+chr(10))
    print(len(sessions),'eligible, original default; actual host still needs verification')

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('site',type=Path);p.add_argument('index',type=Path);p.add_argument('media_registry',type=Path)
    p.add_argument('--edition',required=True)
    p.add_argument('--locale',default='en-US')
    p.add_argument('--voice',default='mike-original')
    a=p.parse_args()
    stage(a.site,a.index,a.media_registry,a.edition,a.locale,a.voice)
