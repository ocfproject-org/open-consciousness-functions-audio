"""Stage only the pinned, already-public Comfort MP3 in the experiment artifact.

Never commit audio. This mirror does not replace the canonical release or grant
redistribution permission for other recordings.
"""
import argparse
import hashlib
from pathlib import Path
import tempfile
import urllib.request
from urllib.parse import urlsplit

SHA256 = '401a132683e40b34576f8411c50096521429f4ee003c8d3d684f775fe07d76ec'
SIZE = 55927570
URL = 'https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/audio-0.2.0/OCF-BOD-003---Comfort---en-US---Mike---Original-Voice---v0.2.0-5d43bb02034a.mp3'
NAME = 'comfort-401a132683e40b34.mp3'


class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urlsplit(newurl)
        if parsed.scheme != 'https' or parsed.hostname not in {'github.com', 'release-assets.githubusercontent.com'} or parsed.username or parsed.password:
            raise ValueError('Unexpected public media redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def stage(stream, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(dir=directory, suffix='.partial', delete=False) as output:
            temp = Path(output.name)
            count = 0
            digest = hashlib.sha256()
            while True:
                block = stream.read(1024 * 1024)
                if not block:
                    break
                count += len(block)
                if count > SIZE:
                    raise ValueError('Public media exceeds pinned size')
                digest.update(block)
                output.write(block)
        if count != SIZE or digest.hexdigest() != SHA256:
            raise ValueError('Public media identity mismatch')
        temp.replace(directory / NAME)
        return directory / NAME
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    with urllib.request.build_opener(PublicRedirect()).open(URL, timeout=60) as response:
        stage(response, args.output)
    print(f'Verified {SIZE} bytes; SHA-256 {SHA256}')


if __name__ == '__main__':
    main()
