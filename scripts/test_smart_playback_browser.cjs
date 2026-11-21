// Serve only the experiment's public build files on an ephemeral loopback port.
// No personal data, credentials, LAN binding or media artifact uploads.
const http=require('http'),fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=path.resolve(process.env.SITE_DIR||'verified-site','experiments/smart-playback');
const allowed=new Set(['preview.html','review.css','review.mjs','composer.mjs','evidence.json','releases.json','test-capture.mjs','comfort-401a132683e40b34.mp3']);
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),name=path.posix.basename(url.pathname);
 if(!['GET','HEAD'].includes(req.method)||!allowed.has(name)||url.pathname!='/experiments/smart-playback/'+name){res.writeHead(404).end();return;}
 const file=path.join(root,name);if(!fs.existsSync(file)){res.writeHead(404).end();return;}
 const size=fs.statSync(file).size;let start=0,end=size-1,status=200;
 if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match){res.writeHead(416).end();return;}start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}status=206;}
 const headers={'Content-Type':name.endsWith('.mp3')?'audio/mpeg':name.endsWith('.mjs')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html','Content-Length':end-start+1,'Accept-Ranges':'bytes'};
 if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 res.writeHead(status,headers);if(req.method==='HEAD'){res.end();return;}const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
});
function run(file,args){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[file,...args],{stdio:'inherit'});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`${file}: exit ${code}`)));});}
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const base=`http://127.0.0.1:${server.address().port}`,out=path.resolve('browser-artifacts/smart-playback');fs.mkdirSync(out,{recursive:true});await run(path.resolve('site/experiments/smart-playback/test-review.cjs'),[base,out]);await run(path.resolve('site/experiments/smart-playback/test-failures.cjs'),[base,path.join(out,'failures.json')]);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
