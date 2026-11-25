import {routeResponse} from './virtual-flac.mjs';
import {compose} from './compose.mjs';
const base=new URL(self.registration.scope), data=new URL('./data/',base);
const metadata=new Map(), plans=new Map();
const get=id=> {
 if(!metadata.has(id))metadata.set(id,fetch(new URL(id+'.json',data),{cache:'no-cache'}).then(r=>{
   if(!r.ok)throw Error('Preview metadata unavailable');return r.json();
 }).catch(e=>{metadata.delete(id);throw e;}));
 return metadata.get(id);
};
const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||!['GET','HEAD'].includes(event.request.method))return;
 const match=/^virtual\/(route|audio|options)\/(OCF-(?:FND-004|EXP-007))(?:\.flac)?$/.exec(url.pathname.slice(base.pathname.length));
 if(!match)return;
 event.respondWith((async()=>{
  try{
   const [,type,id]=match, index=await get(id);
   if(type==='options'){
     if(url.search)return new Response(null,{status:400});
     return json({controls:index.checks.map(c=>({control:c.control,name:c.name,original:c.original,
       options:Object.fromEntries(Object.keys(c.options).map(option=>[option,true]))})),held:index.held});
   }
   const params=new URLSearchParams(url.search);
   const rev=params.getAll('_revision');
   if(type==='route'&&rev.length||type==='audio'&&(rev.length!==1||rev[0]!==index.revision))return new Response(null,{status:400});
   params.delete('_revision');params.sort();
   const key=id+'?'+params;
   let plan=plans.get(key);
   if(!plan){
     try{plan=compose(index,params);}catch{return new Response(null,{status:422});}
     if(plans.size>=8)plans.delete(plans.keys().next().value);
     plans.set(key,plan);
   }
   if(type==='route'){
     params.set('_revision',index.revision);
     return json({url:new URL('virtual/audio/'+id+'.flac',base).pathname+'?'+params,format:'FLAC',seconds:plan.seconds,bookmarks:plan.bookmarks});
   }
   return routeResponse(event.request,plan,await get('inventory'),data);
  }catch{return new Response(null,{status:503});}
 })());
});
