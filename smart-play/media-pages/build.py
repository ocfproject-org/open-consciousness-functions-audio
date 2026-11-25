"""Build a static media artifact from exact previously public GitHub release files."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
import re,sys
from urllib.parse import urlsplit
from urllib.request import urlopen,Request

def main():
    source,output=map(Path,sys.argv[1:3]); cfg=json.loads(source.read_text())
    assert cfg['schema']==1 and bool(re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+",cfg["route"]))
    if sum(x['bytes'] for x in cfg['assets'].values())>=900_000_000:
        raise ValueError('Shard exceeds local headroom threshold')
    out=output/cfg['route'];out.mkdir(parents=True)
    (output/'index.html').write_text('<!doctype html><title>OCF public Smart Play media</title>'
        '<meta name="robots" content="noindex,nofollow,noarchive"><p>Files for the public OCF player.</p>')
    def get(item):
        name,row=item
        if not re.fullmatch(r'[a-zA-Z0-9-]+',name):raise ValueError('Invalid filename')
        url=row['source']
        origin='https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/'
        if not url.startswith(origin):raise ValueError('Not the approved release host')
        if not urlsplit(url[len(origin):]).path.startswith(('audio-0.3.0/','smart-play-unlisted-input-20261125/','smart-play-unlisted-options-20261125/')):
            raise ValueError('Not an approved source release')
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
        assert total==row['bytes'] and digest.hexdigest()==row['sha256'],name
        print(name,total,'verified',flush=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(get,sorted(cfg['assets'].items())))

if __name__=='__main__':
    main()
