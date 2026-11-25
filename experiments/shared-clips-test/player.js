(() => {
  'use strict';
  const el=(name,text)=>{const e=document.createElement(name);if(text)e.textContent=text;return e;};
  const button=(text)=>{const b=el('button',text);b.type='button';return b;};
  const modes={standard:'Original recording',full:'Full guidance',experienced:'Shorter guidance',advanced:'Custom'};
  const values={off:'Off',reminder:'Reminder',short:'Short',full:'Full'};

  const catalog={'resonant-tuning':['Resonant Tuning','off','reminder']};
  const key='ocf.canary.shared-clips.preferences.v1', prefix=key+'.session.';
  const valid=value=>{
    const mode=value?.mode??value?.preset;
    if(!Object.hasOwn(modes,mode))return null;
    const choices=Object.fromEntries(Object.keys(catalog).filter(k=>catalog[k].slice(1).includes(value.choices?.[k])).map(k=>[k,value.choices[k]]));
    return {mode,choices};
  };
  const read=k=>{try{return valid(JSON.parse(localStorage.getItem(k)));}catch{return null;}};
  const write=(k,v)=>{
    if(v)localStorage.setItem(k,JSON.stringify(v));
    else localStorage.removeItem(k);
  };
  const sessionKey=id=>prefix+id.toLowerCase()+'-030';
  const makeMode=()=>{
    const e=el('select');for(const [k,v] of Object.entries(modes))e.add(new Option(v,k));return e;
  };
  let fieldId=0;
  const labeled=(label,ctl)=>{
    const group=el('div'), name=el('label',label);
    ctl.id='local-smart-field-'+(++fieldId);name.htmlFor=ctl.id;
    group.append(name,ctl);return group;
  };
  const optionSummary=setting=>setting?modes[setting.mode]+(setting.mode==='advanced'?Object.entries(setting.choices).map(([k,v])=>' · '+catalog[k][0]+': '+values[v]).join(''):''):modes.standard;
  const prefs=document.getElementById('preferences');
  if(prefs){
    const details=el('details'), summary=el('summary','Smart Play settings');
    details.dataset.localSmartPreferences='';details.append(summary,el('p','Choose defaults for Smart Play sessions in this browser. Saved session choices override the default. Your settings are not uploaded. Guidance applies only where that option is available.'));
    const mode=makeMode(), fields=el('div'), state=el('p'), list=el('ul'), line=el('p');
    const save=button('Save Smart Play default'), reset=button('Reset Smart Play default'), exp=button('Export Smart Play settings');
    const rows=new Map();
    for(const [k,[label,...available]] of Object.entries(catalog)){
      const select=el('select');select.add(new Option('Keep original',''));
      for(const v of available)select.add(new Option(values[v],v));
      fields.append(labeled(label,select));rows.set(k,select);
    }
    state.setAttribute('role','status');line.append(save,' ',reset,' ',exp);
    details.append(labeled('Default guidance',mode),fields,line,state,el('p','Saved for individual sessions:'),list);
    details.hidden=true;
    prefs.append(details);
    window.ocfPreviewAudio.then(url=>{details.hidden=!url;});
    const getSessions=()=>{
      const sessions={};
      try{for(const k of Object.keys(localStorage)){
        if(!k.startsWith(prefix))continue;
        const id=k.slice(prefix.length), setting=read(k);
        if(/^[a-z0-9-]{1,100}$/.test(id)&&setting)sessions[id]=setting;
      }}catch{}
      return sessions;
    };
    const refresh=()=>{
      const defaults=read(key), saved=getSessions();
      mode.value=defaults?.mode||'standard';fields.hidden=mode.value!=='advanced';
      for(const [k,s] of rows)s.value=defaults?.choices[k]||'';
      list.replaceChildren();
      for(const [id,v] of Object.entries(saved)){
        const label=(()=>{try{return localStorage.getItem(prefix+'label.'+id)||id;}catch{return id;}})();
        list.append(el('li',label+': '+optionSummary(v)));
      }
      if(!list.children.length)list.append(el('li','No individual session settings saved.'));
      exp.disabled=!defaults&&!Object.keys(saved).length;
    };
    mode.addEventListener('change',()=>{fields.hidden=mode.value!=='advanced';});
    const commit=setting=>{
      try{
        write(key,setting);
        refresh();
        state.textContent=setting?'Default saved. It will apply when you open a session; current playback has not changed.':'Smart Play default reset. Individual session choices are unchanged.';
      }catch{state.textContent='Browser storage is unavailable. Your default was not saved.';}
    };
    save.addEventListener('click',()=>commit({mode:mode.value,choices:mode.value==='advanced'?Object.fromEntries([...rows].filter(([,s])=>s.value).map(([k,s])=>[k,s.value])):{}}));
    reset.addEventListener('click',()=>commit(null));
    exp.addEventListener('click',()=>{
      const data={schema:1,kind:'ocf-smart-play-preferences',default:read(key),sessions:getSessions()};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const link=el('a');link.href=url;link.download='ocf-smart-play-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      state.textContent='Smart Play settings downloaded.';
    });
    new MutationObserver(()=>{if(prefs.open)refresh();}).observe(prefs,{attributes:true,attributeFilter:['open']});
    window.addEventListener('storage',()=>{if(prefs.open)refresh();});
    refresh();
  }

  const installed=new WeakSet();
  let serial=0;
  function init(audio){
    const fid=audio?.dataset.localSmart, ui=audio?.previousElementSibling;
    const controls=ui?.querySelector('.ocf-local-player');
    if(!fid||!controls||installed.has(audio))return;
    installed.add(audio);
    const iid=++serial, storeKey=sessionKey(fid);
    const inherited=()=>read(storeKey)||read(key)||{mode:'standard',choices:{}};
    const clock=(seconds)=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
    const status=el('p');status.setAttribute('role','status');status.hidden=true;
    const details=el('details'), summary=el('summary','Smart Play bookmarks'), list=el('ul');
    details.append(summary,list);details.hidden=true;
    ui.append(status,details);
    const say=text=>{status.textContent=text;status.hidden=!text;};
    const dialog=el('dialog');dialog.setAttribute('aria-labelledby','local-smart-title-'+iid);dialog.className='ocf-smart-dialog';
    const title=el('h2','Smart Play');title.id='local-smart-title-'+iid;
    const desc=el('p','Edited selections use one continuous FLAC stream. Applying a new selection restarts it paused.');
    const form=el('form'), fields=el('div'), error=el('p');error.setAttribute('role','alert');
    const mode=makeMode(), scope=el('select'), now=el('p'), clear=button('Use site default for this session');
    for(const [k,v] of [['once','This play only'],['session','Remember for this session'],['all','Set as default for all sessions']])scope.add(new Option(v,k));
    const apply=el('button','Apply');apply.type='submit';
    const dismiss=button('Cancel'), reset=button('Restore all original choices');
    form.append(now,labeled('Guidance',mode),fields,labeled('Save choices',scope),error,apply,' ',reset,' ',clear,' ',dismiss);
    dialog.append(title,desc,form);document.body.append(dialog);
    const gear=button('⚙');gear.setAttribute('aria-label','Smart Play settings');
    dialog.id='local-smart-dialog-'+iid;gear.setAttribute('aria-controls',dialog.id);
    gear.setAttribute('aria-haspopup','dialog');gear.title='Smart Play settings';
    gear.hidden=true;gear.className='ocf-local-smart-gear';
    controls.append(gear);controls.classList.add('ocf-local-player--smart');
    let endpoint, opts=[], current={}, applied={mode:'standard',choices:{}}, edited=false, saving=false, ready=false;
    const radio=new Map();
    const captionButton=ui.querySelector('button[aria-pressed]');
    const captions=ui.querySelector('.ocf-recording-captions');
    const track=audio.querySelector('track');
    function setCaptions(edit){
      if(!captionButton)return;
      if(edit&&captionButton.getAttribute('aria-pressed')==='true')captionButton.click();
      captionButton.hidden=edit;
      if(edit&&captions)captions.hidden=true;
      if(edit&&track)track.track.mode='disabled';
    }
    function clearResume(){
      audio.dataset.formatGeneration=String(Number(audio.dataset.formatGeneration||0)+1);
      for(const k of ['ocfResumePosition','ocfResumeEnded','ocfResumePositionExplicit','ocfRestoredBookmarkPending','ocfRestoredBookmarkPosition','ocfRestoredBookmarkEnded','ocfApplyingResume','ocfLiveSeek'])delete audio.dataset[k];
    }
    function original(){
      if(edited){
        audio.pause();audio.removeAttribute('src');clearResume();
        delete audio.dataset.formatUsed;delete audio.dataset.localSmartActive;
        if(!audio.querySelector('source')){
          audio.src=JSON.parse(audio.dataset.formatSources)[audio.dataset.sessionFormat];
        }
        window.ocfFormats?.refresh();
        audio.load();
      }
      edited=false;current={};setCaptions(false);
      details.hidden=true;details.open=false;list.replaceChildren();
    }
    function setBookmarks(books){
      details.open=false;list.replaceChildren();
      for(const b of books){
        const item=el('li'), label=opts.find(o=>o.control===b.control)?.name||b.control;
        const jump=button(label+' · '+clock(Math.max(0,b.at-3)));
        jump.addEventListener('click',()=>{const t=Math.max(0,b.at-3);if(audio.readyState){audio.currentTime=t;}
          else {audio.addEventListener('loadedmetadata',()=>{audio.currentTime=t;},{once:true});audio.load();}});
        item.append(jump);list.append(item);
      }
      details.hidden=!books.length;
    }
    function choicesFor(setting){
      return Object.fromEntries(opts.flatMap(row=>{
        const k=row.control;
        const choice=setting.mode==='full'?'full':setting.mode==='experienced'&&['relaxation','return'].includes(k)?'short':setting.mode==='advanced'?setting.choices[k]:null;
        return Object.hasOwn(row.options,choice)?[[k,choice]]:[];
      }));
    }
    async function applySetting(setting){
      const requested=choicesFor(setting);
      if(JSON.stringify(requested)!==JSON.stringify(current)){
        if(!Object.keys(requested).length)original();
        else{
          const query=new URLSearchParams(requested);
          const r=await fetch(endpoint+'route/'+fid+'?'+query,{cache:'no-store'});
          if(!r.ok)throw Error();
          const route=await r.json();
          if(!route.url.startsWith(endpoint+'audio/'+fid+'.flac?')||route.format!=='FLAC')throw Error();
          audio.pause();clearResume();delete audio.dataset.formatUsed;
          audio.dataset.localSmartActive='true';
          audio.src=route.url;audio.load();edited=true;current=requested;setCaptions(true);
          setBookmarks(route.bookmarks);
        }
      }
      applied=setting;
      say(edited?'Smart Play · FLAC. Original timed text remains available below.':'');
    }
    function draft(setting){
      mode.value=setting.mode;
      const selections=choicesFor(setting);
      for(const [k,s] of radio)s.value=selections[k]||'';
      fields.hidden=false;
    }
    gear.addEventListener('click',()=>{
      now.textContent='Current guidance: '+modes[applied.mode];
      draft(applied);scope.value='once';error.textContent='';
      clear.hidden=!read(storeKey);
      dialog.showModal();mode.focus();
    });
    mode.addEventListener('change',()=>{
      if(mode.value!=='advanced')draft({mode:mode.value,choices:{}});
    });
    dismiss.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>gear.focus());
    dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
    reset.addEventListener('click',()=>draft({mode:'standard',choices:{}}));
    clear.addEventListener('click',()=>{draft(read(key)||{mode:'standard',choices:{}});scope.value='once';form.dataset.clearOnApply='1';clear.hidden=true;});
    dialog.addEventListener('close',()=>delete form.dataset.clearOnApply);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(saving)return;
      error.textContent='';saving=true;apply.disabled=true;dismiss.disabled=true;
      const selected={mode:mode.value,choices:mode.value==='advanced'?Object.fromEntries([...radio].filter(([,s])=>s.value).map(([k,s])=>[k,s.value])):{}};
      const which=scope.value;
      let appliedOK=false;
      try {
        await applySetting(selected);appliedOK=true;
        if(which==='session'){
          write(storeKey,selected);
          try{localStorage.setItem(prefix+'label.'+storeKey.slice(prefix.length),audio.dataset.sessionTitle||fid);}catch{}
        }else if(which==='all'){
          // Preserve choices for controls not offered by the session editing the site default.
          const prior=read(key)?.choices||{};
          const choices=selected.mode==='advanced'?{...Object.fromEntries(Object.entries(prior).filter(([k])=>!radio.has(k))),...selected.choices}:{};
          write(key,{...selected,choices});
          if(form.dataset.clearOnApply)write(storeKey,null);
        }else if(form.dataset.clearOnApply)write(storeKey,null);
        dialog.close();
      } catch(_) {error.textContent=appliedOK?'Applied for this play; browser storage did not save the preference.':'This combination could not be verified. The current recording has not changed.';}
      finally {saving=false;apply.disabled=false;dismiss.disabled=false;}
    });
    const play=controls.querySelector('button');
    let firstPlayQueued=false;
    play.addEventListener('click',event=>{
      if(ready)return;
      event.preventDefault();event.stopImmediatePropagation();firstPlayQueued=true;
    },true);
    window.ocfPreviewAudio.then(url=>{
      if(!url)throw Error();
      endpoint=url;
      return fetch(endpoint+'options/'+fid,{cache:'no-store'});
    }).then(r=>{if(!r.ok)throw Error();return r.json();}).then(async result=>{
      opts=result.controls;
      if(!opts.length)return;
      for(const row of opts){
        const select=el('select');
        select.add(new Option('Original ('+values[row.original]+')',''));
        for(const option of ['full','reminder','short','off'])if(Object.hasOwn(row.options,option))select.add(new Option(values[option],option));
        select.addEventListener('change',()=>{mode.value='advanced';});
        const line=el('p');line.append(labeled(row.name,select));fields.append(line);radio.set(row.control,select);
      }
      if(result.held.length)fields.append(el('p','Options not yet verified are not listed.'));
      mode.querySelector('[value="full"]').disabled=!Object.keys(choicesFor({mode:'full'})).length;
      mode.querySelector('[value="experienced"]').disabled=!Object.keys(choicesFor({mode:'experienced'})).length;
      await applySetting(inherited());
      gear.hidden=false;
    }).catch(()=>{if(opts.length){gear.hidden=false;say('Saved Smart Play guidance could not load. Original recording is available.');}}).finally(()=>{
      ready=true;if(firstPlayQueued&&audio.isConnected)play.click();
    });
  }
  window.ocfLocalSmartInit=init;
})();
