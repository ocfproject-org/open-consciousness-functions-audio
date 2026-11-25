"""Run the real unlisted browser suite against the complete, disposable artifact."""
from pathlib import Path
import subprocess
import sys

here = Path(__file__).resolve().parent
site = Path(sys.argv[1]).resolve()
with subprocess.Popen([sys.executable, "-u", str(here / "shared_clip_canary_test_server.py")],
                      cwd=site, stdout=subprocess.PIPE, text=True) as process:
    try:
        message = process.stdout.readline().strip().split()
        if len(message) != 2 or message[0] != "READY" or not message[1].isdigit():
            raise RuntimeError("Canary HTTP test server did not come up")
        subprocess.run(["node", str(here / "test_shared_clip_canary.cjs"), "http://127.0.0.1:" + message[1]],
                       check=True, timeout=150)
    finally:
        process.terminate()
        process.wait(timeout=15)
