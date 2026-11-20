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
 let original=null,epoch=null,draft=[],generation=0,busy=false,stale=false,invalidate=()=>{},hasInput=()=>false;
 const say=text=>{status.textContent=[text,store.warning].filter(Boolean).join(' ');};
 function describe(row,parent){
  if(row.kind==='custom'){node('p','My own cue',parent).className='routine-meta';return;}
  if(row.kind==='hplus'){const entry=model.historical[row.command],details=node('details',undefined,parent);details.className='routine-provenance';node('summary',`Original Human Plus · ${entry.title} · ${entry.roleLabel}`,details);node('p',`${entry.notation} · ${entry.evidenceLabel}. ${entry.reference}`,details).className='routine-meta';const source=node('a',entry.evidence==='archive-command'?'Public archive command reference':'Pinned project legacy record',details);source.href=entry.source;if(entry.evidence==='archive-command'){node('span',' · ',details);const repo=node('a','Pinned project legacy record',details);repo.href=entry.repoSource;}return;}
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
  if(!busy&&editor.open&&original&&((store.manualConfig()?.epoch??null)!==epoch||JSON.stringify(state)!==JSON.stringify(original))){stale=true;invalidate();}
 }
 function close(message='Routine editor closed.'){if(busy)return;if(hasInput()&&!confirm('Discard unfinished custom cue text? Closing does not undo completed actions.'))return;generation++;editor.open=false;original=null;hasInput=()=>false;summary.focus();say(message);}
 async function open(){
  const turn=++generation;stale=false;hasInput=()=>false;body.replaceChildren();original=store.readRoutine();epoch=store.manualConfig()?.epoch??null;draft=structuredClone(original.rows);
  if(epoch){try{store.routineContext(epoch);}catch(e){node('p',e.message,body);return;}}
  node('p','Search OCF activation/mode cues and optional original Human Plus cues. Favorites use the current guide; Learned choices use the saved guide snapshot. Audio edition does not determine cue text. Imported snapshots are not independently verified.',body);
  node('p','Each completed action saves in this browser. Use Move up and Move down to choose the reading order. Unfinished custom text is not saved. Nothing is added to Favorites or Learned.',body);
  const records=await store.read();if(turn!==generation||!editor.open||(store.manualConfig()?.epoch??null)!==epoch)return;
  const choices=[];const seen=new Set();let unsupported=0;
  function offer(subject,guide,origin,group){
   const commands=model.commands(guide);if(!commands.length){unsupported++;return;}
   for(const c of commands){
    const row={id:crypto.randomUUID(),kind:'function',subject,command:c.command,guide:structuredClone(guide),origin};
    if(!model.eligible(row,store.subjects))continue;
    const key=model.choiceKey(row);if(seen.has(key))continue;seen.add(key);choices.push({row,group});
   }
  }
  records.filter(r=>r.subject.startsWith('OCF-')).forEach(r=>offer(r.subject,r.guide,'learned','Learned — saved guides'));
  store.readFlags().filter(f=>f.kind==='favorite'&&f.subject.startsWith('OCF-')).forEach(f=>offer(f.subject,store.subjects[f.subject]?.guide,'current','Favorite functions — current guides'));
  Object.keys(store.subjects).filter(id=>/^OCF-[A-Z]{3}-[0-9]{3}$/.test(id)).sort().forEach(id=>offer(id,store.subjects[id].guide,'current','All other functions — current guides'));
  for(const [command,entry] of Object.entries(model.historical))choices.push({row:{id:crypto.randomUUID(),kind:'hplus',command,text:entry.text},group:'Original Human Plus — historical cues'});
  const legacyLabel=node('label',undefined,body),legacy=node('input',undefined,legacyLabel);legacy.type='checkbox';legacyLabel.className='routine-original-choice';legacyLabel.append(document.createTextNode(' Show original Human Plus cues'));
  const coverage=node('details',undefined,body);node('summary','Original cue coverage',coverage);
  node('p','Optional, for cues you already learned: 65 historical cues across 55 original titles. Twelve command wordings are individually corroborated in public archive command fields; the other 53 are project-recorded, not individually archive-verified. Roles distinguish function/mode cues, Close, Retrieval, Short Fix release, standalone Release and Cancel. These are not OCF recording cues. Availability and audio equivalence are not verified. Only Attention/Focus shares an existing choice; saved sources never change.',coverage);
  const searchLabel=node('label','Search function cues',body),search=node('input',undefined,searchLabel);search.type='search';search.maxLength=200;search.placeholder='Function name, cue or role';
  const label=node('label','Choose a function cue',body),select=node('select',undefined,label);select.setAttribute('aria-label','Choose a function cue');
  const matches=node('p','',body);matches.setAttribute('role','status');
  const choiceInfo=node('p','',body);choiceInfo.className='routine-choice-info';choiceInfo.setAttribute('role','status');
  const normalize=model.searchText;
  function describeChoice(){const row=select.value===''?null:choices[Number(select.value)]?.row;choiceInfo.textContent=!row?'':row.kind==='hplus'?`${model.historical[row.command].title} — ${row.text}. ${model.historical[row.command].roleLabel}. Original Human Plus · ${model.historical[row.command].evidenceLabel}. Printed: ${model.historical[row.command].notation}`:`${store.subjects[row.subject].title} — ${model.cue(row)}. OCF guide cue.`;}
  select.addEventListener('change',describeChoice);
  function showChoices(){
   const previous=select.value,query=normalize(search.value);select.replaceChildren();node('option','Choose explicitly…',select).value='';let count=0;const groups=new Map();
   choices.forEach(({row,group},i)=>{
    if(draft.some(saved=>model.choiceKey(saved)===model.choiceKey(row)))return;
    const hp=row.kind==='hplus';if(hp&&!legacy.checked)return;
    if(!hp&&legacy.checked&&choices.some(x=>x.row.kind==='hplus'&&model.choiceKey(x.row)===model.choiceKey(row)))return;
    const c=hp?{text:row.text,role:'activation'}:model.commands(row.guide).find(x=>x.command===row.command),title=hp?model.historical[row.command].title:store.subjects[row.subject].title;
    const entry=hp?model.historical[row.command]:null;
    const terms=normalize(`${title} ${c.text} ${row.subject||''} ${entry?`${entry.notation} ${entry.roleLabel} ${entry.legacyCommand} ${entry.evidenceLabel}`:''}`);
    if(!model.matchesSearch(terms,query))return;
    let parent=groups.get(group);if(!parent){parent=node('optgroup',undefined,select);parent.label=group;groups.set(group,parent);}
    const provenance=hp?`Original Human Plus; ${entry.roleLabel}; ${entry.evidenceLabel}`:`OCF ${c.role}; ${row.command}; ${row.origin==='learned'?'learned snapshot':'current guide'} ${row.guide.commit.slice(0,8)}`;
    node('option',`${title} — ${c.text} (${provenance})`,parent).value=String(i);count++;
   });
   if([...select.options].some(option=>option.value===previous))select.value=previous;
   describeChoice();
   matches.textContent=count?`${count} available cue choices. Choose one explicitly.`:'No eligible cues match. Try a function name or activation wording.';
  }
  legacy.addEventListener('change',showChoices);search.addEventListener('input',showChoices);showChoices();
  if(unsupported)node('p','Some learned snapshots have no supported activation command. No replacement cue has been substituted.',body);
  const draftList=node('ol',undefined,body);draftList.className='routine-draft';
  const editorStatus=node('p','Private backups include your cue text. Backups containing Human Plus cues need this version of the site or newer (schema 5).',body);editorStatus.setAttribute('role','status');editorStatus.tabIndex=-1;
  const reload=button('Reload saved routine',body,()=>{if(busy)return;if(hasInput()&&!confirm('Discard unfinished custom cue text and reload the saved routine?'))return;open();});reload.hidden=true;
  invalidate=()=>{editorStatus.textContent='Routine changed in another tab. Your input is kept here, but no action was saved. Reload the saved routine before making changes.';reload.hidden=false;};
  async function commit(candidate,message,onSaved){
   if(busy)return;if(stale){invalidate();editorStatus.focus();return;}
   busy=true;const controls=[...body.querySelectorAll('button,input,select,textarea')].map(n=>[n,n.disabled]);controls.forEach(([n])=>n.disabled=true);
   let applied=false;
   try{
    await store.saveRoutineIntent(candidate,original,epoch);
    original=store.readRoutine();epoch=store.manualConfig()?.epoch??null;draft=structuredClone(original.rows);
    applied=true;render();await refresh();
   }catch(e){editorStatus.textContent='Not saved. '+e.message+' '+store.warning;reload.hidden=false;editorStatus.focus();}
   finally{busy=false;controls.forEach(([n,disabled])=>{if(n.isConnected)n.disabled=disabled;});if(applied){draw();if(store.storage){showChoices();editorStatus.textContent=message;onSaved?.();}else{editorStatus.textContent='Not saved in this browser. A page-only copy is available; keep or export it before leaving. Your input has been kept. '+store.warning;editorStatus.focus();}}render();}
  }
  function draw(focusId,action){
   draftList.replaceChildren();draft.forEach((row,index)=>{
    const li=node('li',undefined,draftList);li.dataset.routineId=row.id;
    node('p',row.kind==='custom'?row.text:model.eligible(row,store.subjects)?model.cue(row):'Unavailable command — retained until you remove it',li).className='routine-cue';
    describe(row,li);
    const actions=node('div',undefined,li);actions.className='routine-actions';
    if(row.kind==='custom')button('Edit custom cue',actions,()=>editCustom(row)).setAttribute('aria-label',`Edit custom cue ${index+1}`);
    for(const [name,delta] of [['Move up',-1],['Move down',1]]){
     const b=button(name,actions,()=>{const candidate=structuredClone(draft),target=index+delta;[candidate[index],candidate[target]]=[candidate[target],candidate[index]];commit(candidate,`Moved to position ${target+1} and saved.`,()=>draw(row.id,name));});
     b.disabled=index+delta<0||index+delta>=draft.length;b.setAttribute('aria-label',`${name}: cue ${index+1}`);b.dataset.action=name;
    }
    button('Remove',actions,()=>{if(busy)return;if(!confirm('Remove this cue from your saved routine?'))return;commit(draft.filter(x=>x.id!==row.id),'Cue removed and saved.',()=>editorStatus.focus());}).setAttribute('aria-label',`Remove cue ${index+1}`);
   });
   if(focusId){const li=[...draftList.children].find(n=>n.dataset.routineId===focusId);const next=[...li.querySelectorAll('button')].find(b=>b.dataset.action===action&&!b.disabled)||li.querySelector('button:not(:disabled)');next?.focus();}
  }
  const add=button('Add selected cue',body,()=>{
   if(select.value===''){editorStatus.textContent='Choose a function cue first.';select.focus();return;}
   const row=choices[Number(select.value)]?.row;if(!row)return;
   if(draft.some(x=>model.choiceKey(x)===model.choiceKey(row))){editorStatus.textContent='That guide command is already in your routine.';return;}
   if(draft.length>=model.MAX){editorStatus.textContent='The routine limit is 50 cues.';return;}
   commit([...draft,{...structuredClone(row),id:crypto.randomUUID()}],'Cue added and saved. Choose another cue.',()=>{search.value='';select.value='';showChoices();search.focus();});
  });
  body.insertBefore(add,draftList);
  const customAdd=button('Add custom cue',body,()=>editCustom(null));
  const custom=node('div',undefined,body);custom.className='routine-custom-editor';custom.hidden=true;
  const customLabel=node('label','Custom cue',custom),text=node('textarea',undefined,customLabel);text.maxLength=500;
  let editing=null,initialText='';
  hasInput=()=>!custom.hidden&&text.value!==initialText;
  function editCustom(row){
   if(busy)return;if(hasInput()&&!confirm('Discard unfinished custom cue text?'))return;
   editing=row;initialText=row?.text||'';text.value=initialText;custom.hidden=false;apply.textContent=row?'Apply custom edit':'Add custom cue now';text.focus();
  }
  const customActions=node('div',undefined,custom);customActions.className='routine-actions';
  const apply=button('Add custom cue now',customActions,()=>{
   if(editing&&!draft.some(row=>row.id===editing.id)){editorStatus.textContent='This cue was removed. Your unfinished text is still here; cancel this edit before adding a new cue.';editorStatus.focus();return;}
   if(!text.value.trim()){editorStatus.textContent='Enter a custom cue first.';text.focus();return;}
   if(!editing&&draft.length>=model.MAX){editorStatus.textContent='The routine limit is 50 cues.';return;}
   const row=editing?{...editing,text:text.value}:{id:crypto.randomUUID(),kind:'custom',text:text.value};
   const candidate=editing?draft.map(x=>x.id===editing.id?row:x):[...draft,row];
   commit(candidate,editing?'Custom edit saved.':'Custom cue added and saved.',()=>{initialText=text.value;custom.hidden=true;customAdd.focus();});
  });
  button('Cancel custom edit',customActions,()=>{if(hasInput()&&!confirm('Discard unfinished custom cue text?'))return;custom.hidden=true;customAdd.focus();});
  button('Done',body,()=>close());draw();

 }
 summary.addEventListener('click',event=>{if(editor.open){event.preventDefault();close();}});
 editor.addEventListener('toggle',()=>{list.hidden=editor.open;if(editor.open)open();else{generation++;original=null;}});
 editor.addEventListener('keydown',event=>{if(event.key==='Escape'&&!busy){event.preventDefault();close();}});
 document.addEventListener('ocf-private-library-change',render);
 for(const event of ['pageshow','popstate'])window.addEventListener(event,()=>{if(editor.open)close();render();});render();
}
document.addEventListener('ocf-private-library-ready',start);start();
})();
