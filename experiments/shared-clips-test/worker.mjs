import {routeResponse} from './virtual-flac.mjs';
const base=new URL(self.registration.scope), data=new URL('./data/',base);
const offered={'OCF-FND-004':['reminder'],'OCF-EXP-007':['reminder','off']};
const get=async path=>{
 const r=await fetch(new URL(path,data),{cache:'no-cache'});if(!r.ok)throw Error();return r.json();
};
const metadata=new Map();
function cached(id){
 if(!metadata.has(id))metadata.set(id,get(id).catch(e=>{metadata.delete(id);throw e;}));
 return metadata.get(id);
}
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
   const [,type,id]=match, keys=offered[id];
   if(type==='options'){
     if(url.search)return new Response(null,{status:400});
     return json({controls:[{control:'resonant-tuning',name:'Resonant Tuning',original:keys.includes('off')?'full':'off',options:Object.fromEntries(keys.map(x=>[x,true]))}],held:[]});
   }
   const choice=url.searchParams.get('resonant-tuning');
   if(!keys.includes(choice)||url.searchParams.getAll('resonant-tuning').length!==1)return new Response(null,{status:404});
   const recipe=await cached(id+'-'+choice+'.json');
   if(type==='route'){
     if([...url.searchParams].length!==1)return new Response(null,{status:400});
     return json({url:new URL('virtual/audio/'+id+'.flac?resonant-tuning='+choice+'&_revision='+recipe.revision,base).pathname+'?resonant-tuning='+choice+'&_revision='+recipe.revision,format:'FLAC',seconds:recipe.seconds,bookmarks:recipe.bookmarks});
   }
   if([...url.searchParams].length!==2||url.searchParams.get('_revision')!==recipe.revision)return new Response(null,{status:404});
   return routeResponse(event.request,recipe,await cached('inventory.json'),data);
  }catch{return new Response(null,{status:503});}
 })());
});
