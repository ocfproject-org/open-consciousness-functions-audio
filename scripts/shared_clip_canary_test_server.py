from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import re,sys
class Static(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  path=Path(self.translate_path(self.path))
  spec=self.headers.get('Range')
  if not spec or path.suffix!='.flac' or not path.is_file():
   return super().do_GET()
  m=re.fullmatch(r'bytes=(\d+)-(\d*)',spec)
  size=path.stat().st_size
  a,b=(int(m[1]),min(int(m[2]),size-1) if m[2] else size-1) if m else (-1,-1)
  if not 0<=a<=b<size:
   self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return
  self.send_response(206);self.send_header('Accept-Ranges','bytes')
  self.send_header('Content-Range',f'bytes {a}-{b}/{size}')
  self.send_header('Content-Length',str(b-a+1));self.send_header('Content-Type','audio/flac');self.end_headers()
  try:
   with path.open('rb') as file:
    file.seek(a);left=b-a+1
    while left:
     chunk=file.read(min(left,1<<18));self.wfile.write(chunk);left-=len(chunk)
  except (BrokenPipeError, ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Static)
print('READY',server.server_port,flush=True)
server.serve_forever()
