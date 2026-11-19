/* Voluntary local reading list. Saved guide cues are not recording claims. */
(()=>{
'use strict';const root=document.querySelector('[data-morning-routine]');if(!root)return;
const model=window.ocfMorningState;
const node=(tag,text,parent)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent?.append(n);return n;};
const button=(text,parent,action)=>{const b=node('button',text,parent);b.type='button';b.addEventListener('click',action);return b;};
let started=false;
function start(){
 if(started||!window.ocfPrivateLibrary)return;started=true;
 const {store,refresh}=window.ocfPrivateLibrary;
 const list=node('ol',undefined,root);list.className='routine-reading';
 const status=node('p','',root);status.setAttribute('role','status');status.tabIndex=-1;
 const editor=node('details',undefined,root);editor.className='routine-editor';const summary=node('summary','Edit routine',editor);
 const body=node('div',undefined,editor);
 let original=null,epoch=null,draft=[],generation=0,busy=false;
 const say=text=>{status.textContent=[text,store.warning].filter(Boolean).join(' ');};
 function describe(row,parent){
  if(row.kind==='custom'){node('p','My own cue',parent).className='routine-meta';return;}
  const command=model.commands(row.guide).find(c=>c.command===row.command);
  const details=node('details',undefined,parent);details.className='routine-provenance';node('summary',`${store.subjects[row.subject].title} · ${command.role==='mode'?'Alternate mode':'Activation'} · guide ${row.guide.commit.slice(0,8)}`,details);parent=details;
  node('p',row.command,parent).className='routine-meta';
  node('p',`${row.origin==='learned'?'Saved learned guide':'Chosen current guide'} ${row.guide.commit.slice(0,12)} · ${row.guide.locale}. Personal snapshot; imported text is not independently verified. Recording cue equivalence is not verified.`,parent).className='routine-meta';
  const link=node('a','Current instructions',parent);link.href=`../functions/${row.subject}/`;
  node('span',' · ',parent);const source=node('a','Saved source revision',parent);source.href=`https://github.com/ocfproject-org/open-consciousness-functions/tree/${row.guide.commit}`;
 }
 function render(){
  const state=store.readRoutine();list.replaceChildren();
  if(!state.rows.length)node('li','No cues saved. Open Edit routine to choose functions or add your own cue.',list);
  for(const row of state.rows){const li=node('li',undefined,list);node('p',model.eligible(row,store.subjects)?model.cue(row):'This command is no longer supported in the current guide. Its saved entry is retained; review or remove it in Edit routine.',li).className='routine-cue';describe(row,li);}
  if(store.warning)say('');
  if(editor.open&&original&&((store.manualConfig()?.epoch??null)!==epoch||JSON.stringify(state)!==JSON.stringify(original))){generation++;editor.open=false;original=null;summary.focus();say('Private data changed in another tab. Unsaved edits were closed; reopen the routine.');}
 }
 function close(message='Edits canceled.'){generation++;editor.open=false;original=null;summary.focus();say(message);}
 async function open(){
  const turn=++generation;body.replaceChildren();original=store.readRoutine();epoch=store.manualConfig()?.epoch??null;draft=structuredClone(original.rows);
  if(epoch){try{store.routineContext(epoch);}catch(e){node('p',e.message,body);return;}}
  node('p','Search all published activation cues. Favorites use the current guide; Learned choices use the saved guide snapshot. Audio edition does not determine cue text. Imported snapshots are not independently verified.',body);
  node('p','Your routine reads from top to bottom. Use Move up and Move down to choose its order, then Save routine. Nothing is added to Favorites or Learned.',body);
  const records=await store.read();if(turn!==generation||!editor.open||(store.manualConfig()?.epoch??null)!==epoch)return;
  const choices=[];const seen=new Set();let unsupported=0;
  function offer(subject,guide,origin,group){
   const commands=model.commands(guide);if(!commands.length){unsupported++;return;}
   for(const c of commands){
    const row={id:crypto.randomUUID(),kind:'function',subject,command:c.command,guide:structuredClone(guide),origin};
    if(!model.eligible(row,store.subjects))continue;
    const key=[origin,subject,c.command,guide.commit,guide.fingerprint].join('|');if(seen.has(key))continue;seen.add(key);choices.push({row,group});
   }
  }
  store.readFlags().filter(f=>f.kind==='favorite'&&f.subject.startsWith('OCF-')).forEach(f=>offer(f.subject,store.subjects[f.subject]?.guide,'current','Favorite functions — current guides'));
  records.filter(r=>r.subject.startsWith('OCF-')).forEach(r=>offer(r.subject,r.guide,'learned','Learned — saved guides'));
  Object.keys(store.subjects).filter(id=>/^OCF-[A-Z]{3}-[0-9]{3}$/.test(id)).sort().forEach(id=>offer(id,store.subjects[id].guide,'current','All other functions — current guides'));
  const searchLabel=node('label','Search function cues',body),search=node('input',undefined,searchLabel);search.type='search';search.maxLength=200;search.placeholder='Function name or activation cue';
  const label=node('label','Choose a function cue',body),select=node('select',undefined,label);select.setAttribute('aria-label','Choose a function cue');
  const matches=node('p','',body);matches.setAttribute('role','status');
  const normalize=value=>value.normalize('NFKC').toLocaleLowerCase().trim();
  function showChoices(){
   const previous=select.value,query=normalize(search.value);select.replaceChildren();node('option','Choose explicitly…',select).value='';let count=0;const groups=new Map();
   choices.forEach(({row,group},i)=>{const c=model.commands(row.guide).find(x=>x.command===row.command);if(query&&!normalize(`${store.subjects[row.subject].title} ${c.text} ${row.subject}`).includes(query))return;let parent=groups.get(group);if(!parent){parent=node('optgroup',undefined,select);parent.label=group;groups.set(group,parent);}node('option',`${store.subjects[row.subject].title} — ${c.text} (${c.role}; ${row.origin==='learned'?'learned snapshot':'current guide'} ${row.guide.commit.slice(0,8)})`,parent).value=String(i);count++;});
   if([...select.options].some(option=>option.value===previous))select.value=previous;
   matches.textContent=count?`${count} eligible guide commands. Choose one explicitly.`:'No eligible cues match. Try a function name or activation wording.';
  }
  search.addEventListener('input',showChoices);showChoices();
  if(unsupported)node('p','Some learned snapshots have no supported activation command. No replacement cue has been substituted.',body);
  const draftList=node('ol',undefined,body);draftList.className='routine-draft';
  function draw(focusId,action){
   draftList.replaceChildren();draft.forEach((row,index)=>{
    const li=node('li',undefined,draftList);li.dataset.routineId=row.id;
    if(row.kind==='custom'){const label=node('label','Custom cue',li),text=node('textarea',undefined,label);text.maxLength=500;text.value=row.text;text.setAttribute('aria-label',`Custom cue ${index+1}`);text.addEventListener('input',()=>{row.text=text.value;});}
    else {node('p',model.eligible(row,store.subjects)?model.cue(row):'Unavailable command — retained until you remove it',li);describe(row,li);}
    const actions=node('div',undefined,li);actions.className='routine-actions';
    for(const [name,delta] of [['Move up',-1],['Move down',1]]){const b=button(name,actions,()=>{const target=index+delta;[draft[index],draft[target]]=[draft[target],draft[index]];draw(row.id,name);editorStatus.textContent=`Moved to position ${target+1}. Save routine to keep this order.`;});b.disabled=index+delta<0||index+delta>=draft.length;b.setAttribute('aria-label',`${name}: cue ${index+1}`);b.dataset.action=name;}
    button('Remove',actions,()=>{draft.splice(index,1);draw();editorStatus.textContent='Cue removed from draft. Save to apply, or Cancel to keep the saved list.';editorStatus.focus();}).setAttribute('aria-label',`Remove cue ${index+1}`);
   });
   if(focusId){const li=[...draftList.children].find(n=>n.dataset.routineId===focusId);const next=[...li.querySelectorAll('button')].find(b=>b.dataset.action===action&&!b.disabled)||li.querySelector('button:not(:disabled)');next?.focus();}
  }
  const add=button('Add selected cue',body,()=>{
   if(select.value===''){editorStatus.textContent='Choose a function cue first.';select.focus();return;}
   const row=choices[Number(select.value)].row;
   if(draft.some(x=>x.kind==='function'&&x.subject===row.subject&&x.command===row.command&&x.guide.fingerprint===row.guide.fingerprint&&x.guide.commit===row.guide.commit)){editorStatus.textContent='That guide command is already in your draft.';return;}
   if(draft.length>=model.MAX){editorStatus.textContent='The routine limit is 50 cues.';return;}
   draft.push({...structuredClone(row),id:crypto.randomUUID()});draw();editorStatus.textContent='Added to draft. Save routine to keep it.';
  });
  // Keep selection and its action together, before the ordered draft.
  body.insertBefore(add,draftList);
  button('Add custom cue',body,()=>{if(draft.length>=model.MAX){editorStatus.textContent='The routine limit is 50 cues.';return;}draft.push({id:crypto.randomUUID(),kind:'custom',text:''});draw();draftList.lastElementChild.querySelector('textarea').focus();});
  const editorStatus=node('p','Nothing changes until you save. Private backups include your cue text.',body);editorStatus.setAttribute('role','status');editorStatus.tabIndex=-1;
  const actions=node('div',undefined,body);actions.className='routine-actions';
  const cancel=button('Cancel routine edits',actions,()=>close());
  const save=button('Save routine',actions,async()=>{
   if(busy)return;busy=true;save.disabled=true;cancel.disabled=true;
   try{const candidate=structuredClone(draft);const saved=await store.saveRoutineIntent(candidate,original,epoch);close(!saved?'No cues selected. Nothing was saved.':store.storage?'Routine saved in this browser.':'Routine available on this page only; not saved in this browser.');render();await refresh();}
   catch(e){editorStatus.textContent=e.message+' '+store.warning;editorStatus.focus();}
   finally{busy=false;save.disabled=false;cancel.disabled=false;}
  });draw();
 }
 editor.addEventListener('toggle',()=>{list.hidden=editor.open;if(editor.open)open();else{generation++;original=null;}});
 editor.addEventListener('keydown',event=>{if(event.key==='Escape'&&!busy){event.preventDefault();close();}});
 document.addEventListener('ocf-private-library-change',render);
 for(const event of ['pageshow','popstate'])window.addEventListener(event,()=>{if(editor.open)close();render();});render();
}
document.addEventListener('ocf-private-library-ready',start);start();
})();
