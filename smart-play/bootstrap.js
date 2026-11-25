(() => {
 'use strict';
 const marker=document.querySelector('script[data-ocf-smart-play]');
 const manifest='/assets/data/smart-play/registry.json';
 const readRegistry=async()=>{
  const r=await fetch(manifest,{cache:'no-cache',redirect:'error',credentials:'omit'});
  if(!r.ok)throw Error('Smart Play is not configured');
  return r.json();
 };
 window.ocfPublicSmartRegistry=readRegistry().catch(()=>null);
 // Edition and function identity are checked before any audio source is changed.
 const manager=navigator.serviceWorker;
 window.ocfPublicSmartAudio=(async()=>{
  if(!manager||!marker?.dataset.serviceWorker)return null;
  const reg=await window.ocfPublicSmartRegistry;
  if(!reg)return null;
  const expected=new URL(marker.dataset.serviceWorker,location.origin).href;
  const isCurrent=()=>manager.controller?.scriptURL===expected;
  try{
   await manager.register(expected,{type:'module',scope:'/',updateViaCache:'none'});
   if(!isCurrent())await new Promise((resolve,reject)=>{
    const updated=()=>{if(isCurrent()){clearTimeout(timer);manager.removeEventListener('controllerchange',updated);resolve();}};
    const timer=setTimeout(()=>{manager.removeEventListener('controllerchange',updated);reject();},7000);
    manager.addEventListener('controllerchange',updated);updated();
   });
   return '/__ocf-smart/';
  }catch{return null;}
 })();
})();
