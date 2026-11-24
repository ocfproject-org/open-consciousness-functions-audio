"""Build one unlisted continuous Smart Play edit from the exact public Energy Ball.
The unchanged canonical release and old experiment are deliberately separate.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory
import urllib.request

from smart_playback_media import PublicRedirect

BASE = 'https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/audio-0.3.0/OCF-EXP-007---Energy-Ball---en-US---Mike---Original-Voice---v0.3.0-'
MP3 = ('615be1781932.mp3', 88433235, 'b8c0429502dd5e7f6f8e0f92cbdaad9efd6b2738cec0b8cdb47949ac902c12d3')
VTT = ('626a1cf379b6.vtt', 25100, 'adf216aa9e8427cfe140954b21415a0faae976da92404e5176db3d79edd09ef0')
BEFORE = 468.1
AFTER = 676
FADE = 0.5
EXPECTED = 2198.54 - (AFTER - BEFORE) - FADE

def verify_file(path, spec):
    if path.stat().st_size != spec[1]:
        raise ValueError('Unexpected public input size')
    with path.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != spec[2]:
            raise ValueError('Unexpected public input digest')

def download(spec, path):
    count = 0
    with urllib.request.build_opener(PublicRedirect()).open(BASE + spec[0], timeout=60) as res, path.open('wb') as out:
        while block := res.read(1048576):
            count += len(block)
            if count > spec[1]:
                raise ValueError('Unexpected public input size')
            out.write(block)
    verify_file(path, spec)

def clock(value):
    hours, minutes, seconds = value.split(':')
    return 3600 * int(hours) + 60 * int(minutes) + float(seconds)

def verify_cuts(subtitles):
    text = subtitles.read_text(encoding='utf-8')
    cues = [(clock(a), clock(b)) for a, b in re.findall(
        r'^(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})', text, re.M)]
    if len(cues) < 20 or not all(any(x < cut < y for (_, x), (y, _) in zip(cues, cues[1:]))
                                for cut in [BEFORE-FADE-.25, BEFORE+.25, AFTER-.25, AFTER+FADE+.25]):
        raise ValueError('Public timing no longer confirms speech-free overlap')
    dropped = [(a, b) for a, b in cues if a >= BEFORE and b <= AFTER]
    if len(dropped) != 13 or not (470 < dropped[0][0] < 474 and 675 < dropped[-1][1] < 676):
        raise ValueError('Public timing no longer matches the Resonant Tuning block')

def stage(destination, local_inputs=None):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix='ocf-public-smart-play-', dir=destination) as temp:
        folder = Path(temp)
        if local_inputs is None:
            source, captions = folder / 'source.mp3', folder / 'source.vtt'
            download(MP3, source)
            download(VTT, captions)
        else:
            source, captions = (Path(value) for value in local_inputs)
            verify_file(source, MP3)
            verify_file(captions, VTT)
        verify_cuts(captions)
        result = folder / 'edit.mp3'
        filters = (f'[0:a]asplit=2[a][b];[a]atrim=end={BEFORE},asetpts=PTS-STARTPTS[l];'
                   f'[b]atrim=start={AFTER},asetpts=PTS-STARTPTS[r];'
                   f'[l][r]acrossfade=d={FADE}:c1=tri:c2=tri[o]')
        subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(source),'-filter_complex',filters,
                        '-map','[o]','-map_metadata','-1','-ar','44100','-ac','2',
                        '-c:a','libmp3lame','-b:a','320k',str(result)], check=True, timeout=150)
        metadata = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','a:0',
            '-show_entries','stream=channels,sample_rate,codec_name,duration','-of','json',str(result)], timeout=20))
        stream, = metadata['streams']
        if (stream['codec_name'] != 'mp3' or stream['sample_rate'] != '44100' or stream['channels'] != 2
            or abs(float(stream['duration']) - EXPECTED) > 0.12 or not 75000000 < result.stat().st_size < 85000000):
            raise ValueError('Unlisted edit does not match the verified duration or audio format')
        with result.open('rb') as media:
            digest = hashlib.file_digest(media, 'sha256').hexdigest()
        name = f'energy-ball-tuning-off-{digest[:16]}.mp3'
        proof = {'file':name,'bytes':result.stat().st_size,'sha256':digest,
                 'source_sha256':MP3[2],'duration':float(stream['duration']),'join':BEFORE-FADE}
        result.replace(destination / name)
        (destination / 'stream.json').write_text(json.dumps(proof, sort_keys=True) + '\n',encoding='utf-8')
        return proof

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--local-inputs', nargs=2, type=Path)
    args = parser.parse_args()
    print(json.dumps(stage(args.output, args.local_inputs), sort_keys=True))
