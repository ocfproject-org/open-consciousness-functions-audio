const message=document.getElementById('setup');
const enable=document.getElementById('enable');
const openPreferences=document.querySelector('[data-preferences-open]');
const dialog=document.getElementById('preferences');
openPreferences.onclick=()=>dialog.showModal();
dialog.querySelector('button').onclick=()=>dialog.close();
const originals=document.getElementById('originals');
const load=async()=>{
 if(document.querySelector('script[data-ready-player]'))return;
 const player=document.createElement('script');player.dataset.readyPlayer='';
 player.src='./player.js';document.head.append(player);
 player.addEventListener('load',()=>{message.textContent='Shared-clip test is ready.';openPreferences.hidden=false;});
};
async function enableWorker(){
 try{
   await navigator.serviceWorker.register('./worker.mjs',{type:'module',scope:'./',updateViaCache:'none'});
   await navigator.serviceWorker.ready;
   if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
     const timer=setTimeout(reject,10000);
     navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});
   });
   await load();
 }catch{message.textContent='Smart Play could not start. The original players remain available.';enable.disabled=false;}
}
enable.onclick=()=>{enable.disabled=true;message.textContent='Starting the isolated audio test…';enableWorker();};
if(navigator.serviceWorker?.controller){enable.disabled=true;load();}
