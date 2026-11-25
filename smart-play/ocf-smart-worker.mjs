/* Standard playback and all unrelated paths bypass this worker. */
import {routeResponse} from './assets/js/smart-play/virtual-flac.mjs';
import {compose} from './assets/js/smart-play/compose.mjs';
const origin=self.location.origin, endpoint='/__ocf-smart/';
const manifest=new URL('/assets/data/smart-play/registry.json',origin);
let catalog;
const tracks=new Map(), plans=new Map();
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const load=async url=>{
 const r=await fetch(url,{cache:'no-cache',redirect:'error',credentials:'omit'});
 if(!r.ok)throw Error('Unable to load Smart Play index');
 return r.json();
};
const registry=()=>catalog??=load(manifest).catch(e=>{catalog=null;throw e;});
const remember=(cache,k,v,limit)=>{
 if(cache.size>=limit)cache.delete(cache.keys().next().value);
 cache.set(k,v);return v;
};
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(url.origin!==origin||!url.pathname.startsWith(endpoint)||!['GET','HEAD'].includes(request.method))return;
 const match=/^(options|route|audio)\/(OCF-[A-Z]{3}-\d{3})(\.flac)?$/.exec(url.pathname.slice(endpoint.length));
 if(!match)return;
 event.respondWith((async()=>{
  try{
   const [,type,id,suffix]=match;
   if(Boolean(suffix)!==(type==='audio'))return new Response(null,{status:404});
   const reg=await registry();
   if(!Object.hasOwn(reg.sessions,id))return new Response(null,{status:404});
   const session=reg.sessions[id];
   if(type==='options')return url.search ? new Response(null,{status:400}) : json(session);
   const params=new URLSearchParams(url.search),version=params.getAll('_revision');
   if(type==='route'?version.length:version.length!==1||version[0]!==reg.revision)return new Response(null,{status:404});
   params.delete('_revision');params.sort();
   const key=id+'?'+params.toString();
   let plan=plans.get(key);
   if(!plan){
    const index=await (tracks.get(id)??remember(tracks,id,load(new URL(id+'.json',manifest)).catch(e=>{tracks.delete(id);throw e;}),4));
    if(index.revision!==reg.revision)throw Error('Stale session index');
    try{plan=compose(index,params);}catch{return new Response(null,{status:422});}
    remember(plans,key,plan,8);
   }
   if(type==='route'){
    params.set('_revision',reg.revision);
    return json({url:endpoint+'audio/'+id+'.flac?'+params,format:'FLAC',seconds:plan.seconds,bookmarks:plan.bookmarks});
   }
   return routeResponse(request,plan,reg.inventory,new URL(reg.mediaBase,origin));
  }catch{return new Response(null,{status:503});}
 })());
});
