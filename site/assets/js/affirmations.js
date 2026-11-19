/* Device-local optional reflection; no requests, personal URLs or automatic actions. */
(() => {
  'use strict';
  const root=document.querySelector('[data-affirmations-view]'); if(!root)return;
  const model=window.ocfAffirmationsState, data=model.data;
  const node=(tag,text,parent)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent?.append(n);return n;};
  const button=(text,parent,action)=>{const b=node('button',text,parent);b.type='button';b.addEventListener('click',action);return b;};
  let started=false;
  function start() {
    if(started||!window.ocfPrivateLibrary)return; started=true;
    const {store,refresh:refreshPrivate}=window.ocfPrivateLibrary;
    const morning=root.dataset.affirmationsView==='morning';
    const list=root.querySelector('[data-affirmation-list]'), status=root.querySelector('[data-affirmation-status]'), count=root.querySelector('[data-affirmation-count]');
    count.setAttribute('role','status');count.tabIndex=-1;
    const PAGE=50;let visible=PAGE;
    const more=button('Show 50 more lines',list.parentElement,()=>{const before=visible;visible+=PAGE;render();const next=list.children[before]?.querySelector('.affirmation-text');if(next){next.tabIndex=-1;next.focus({preventScroll:true});}else status.focus();});more.hidden=true;list.after(more);
    const search=root.querySelector('[data-affirmation-search]'), category=root.querySelector('[data-affirmation-category]');
    let collection=null, collectionHelp=null;
    if(!morning && data.lines.some(item=>item.archived)){
      const label=node('label','Collection',category.parentElement.parentElement);collection=node('select',undefined,label);collection.setAttribute('aria-label','Collection');
      for(const [value,text] of [['public','Public library only'],['current','Current library & my lines'],['archive','Archived lines / original starters'],['custom','My own lines'],['all','All, including archive']])node('option',text,collection).value=value;
      collectionHelp=node('p','Original starters remain available here and in saved favorites.',root.querySelector('[data-affirmation-controls]'));collectionHelp.className='affirmation-help';collectionHelp.hidden=true;
    }
    const add=root.querySelector('[data-affirmation-add]');
    let managing=false;
    if(morning){
      list.id='morning-affirmations';add.hidden=true;
      const manage=button('Manage favorites',add.parentElement,()=>{managing=!managing;add.hidden=!managing;manage.textContent=managing?'Done managing favorites':'Manage favorites';manage.setAttribute('aria-expanded',String(managing));render();});
      manage.setAttribute('aria-expanded','false');manage.setAttribute('aria-controls',list.id);add.before(manage);
    }

    const dialog=node('dialog',undefined,document.body);dialog.className='affirmation-dialog';dialog.setAttribute('aria-labelledby','affirmation-editor-title');
    const form=node('form',undefined,dialog), title=node('h2','Add my own line',form);title.id='affirmation-editor-title';
    const label=node('label','My affirmation (up to 500 characters)',form), text=node('textarea',undefined,label);text.maxLength=500;text.required=true;
    const catLabel=node('label','Category',form), cat=node('select',undefined,catLabel);cat.setAttribute('aria-label','Category');
    for(const [id,label] of Object.entries(data.categories)){node('option',label,cat).value=id;if(category)node('option',label,category).value=id;}
    const favoriteLabel=node('label',undefined,form);favoriteLabel.className='affirmation-check';const favorite=node('input',undefined,favoriteLabel);favorite.type='checkbox';node('span','Save straight to My Morning',favoriteLabel);
    node('p','Only saved in this browser. Private backups can contain this personal text. You choose whether to include a line in My Morning.',form);
    const editorStatus=node('p','',form);editorStatus.setAttribute('role','status');
    const actions=node('div',undefined,form);actions.className='affirmation-actions';
    let original=null, epoch=null, opener=null, originalFavorite=false;
    function close(){dialog.close();if(opener?.isConnected)opener.focus();else status.focus();}
    button('Cancel',actions,close);const save=node('button','Save line',actions);save.type='submit';
    function edit(item,trigger){
      original=item?{...item}:null;epoch=store.affirmationConfig()?.epoch??null;opener=trigger;
      title.textContent=item?'Edit my line':'Add my own line';text.value=item?.text||'';cat.value=item?.category||Object.keys(data.categories)[0];
      favorite.checked=item?store.readAffirmations().favorites.includes(item.id):morning;originalFavorite=favorite.checked;editorStatus.textContent='Nothing changes until you save.';
      dialog.showModal();text.focus();
    }
    let lastMessage='';
    const say=message=>{lastMessage=message;status.textContent=[message,store.warning].filter(Boolean).join(' ');};
    function act(action){try{const message=action();say(message);render();refreshPrivate();}catch(error){say(error.message);}}
    add.addEventListener('click',()=>edit(null,add));
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    form.addEventListener('submit',event=>{
      event.preventDefault();
      try {
        const item={id:original?.id||`custom:${crypto.randomUUID()}`,text:text.value.trim(),category:cat.value};
        model.line(item);
        if((store.affirmationConfig()?.epoch??null)!==epoch)throw Error('Saved local data changed in another tab. Reopen the editor before saving.');
        if(!epoch)epoch=store.enableAffirmations().epoch;
        store.saveCustom(item,original,epoch);if(!original||favorite.checked!==originalFavorite)store.favoriteAffirmation(item.id,favorite.checked,epoch);
        if(collection&&!original)collection.value='custom';
        close();say(store.storage?'Your line is saved. '+(store.readAffirmations().favorites.includes(item.id)?'It is in My Morning.':'It is in your library.'):'Your line is available on this page only; it was not saved in this browser.');render();refreshPrivate();
      }catch(error){editorStatus.textContent=error.message+' '+store.warning;}
    });
    function render(){
      const current=store.readAffirmations();
      if(collectionHelp)collectionHelp.hidden=collection.value!=='archive';
      const focused=document.activeElement, focusId=focused?.dataset.affirmationId, focusAction=focused?.dataset.action;
      list.replaceChildren();list.classList.toggle('morning-affirmation-list',morning&&!managing);
      const favoriteIds=new Set(current.favorites);
      const query=(search?.value||'').trim().toLocaleLowerCase();
      const candidates=morning?[...data.lines,...current.custom]:[...current.custom,...data.lines];
      const items=candidates.filter(item=>(!morning||favoriteIds.has(item.id))&&(!collection||collection.value==='all'||(collection.value==='current'&&!item.archived)||(collection.value==='public'&&!item.archived&&!model.customId(item.id))||(collection.value==='archive'&&item.archived)||(collection.value==='custom'&&model.customId(item.id)))&&(!category?.value||item.category===category.value)&&(!query||`${item.text} ${data.categories[item.category]} ${item.subtopic||''}`.toLocaleLowerCase().includes(query)));
      count.textContent=morning?`${items.length} saved ${items.length===1?'line':'lines'} on this device`:`${items.length} matching lines`;
      if(!items.length)node('li',morning?'Your morning affirmation list is empty. Choose hearts in the library or add a line of your own.':'No lines match. Try another word or clear the filters.',list);
      more.hidden=items.length<=visible;
      if(!more.hidden)more.textContent=`Show ${Math.min(PAGE,items.length-visible)} more lines`;
      if(items.length>visible)count.textContent+=` · Showing ${visible}`;
      items.slice(0,visible).forEach(item=>{
        if(morning&&!managing){const row=node('li',undefined,list);row.className='morning-affirmation';node('p',item.text,row).className='affirmation-text';return;}
        const card=node('li',undefined,list);card.className='affirmation-card';card.dataset.affirmationId=item.id;
        node('p',item.text,card).className='affirmation-text';
        const categoryRow=node('p',undefined,card);categoryRow.className='affirmation-category';
        if(category){const choose=button(data.categories[item.category],categoryRow,()=>{category.value=item.category;visible=PAGE;render();count.focus();});choose.className='affirmation-category-filter';choose.setAttribute('aria-label',`Filter category: ${data.categories[item.category]}`);}
        else node('span',data.categories[item.category],categoryRow);
        node('span',`${item.subtopic?' · '+item.subtopic:''}${item.archived?(item.id.startsWith('starter:')?' · Archived starter':' · Archived line'):''}${model.customId(item.id)?' · My own line':''}`,categoryRow);
        const actions=node('div',undefined,card);actions.className='affirmation-actions';const on=favoriteIds.has(item.id);
        const heart=button(on?'♥':'♡',actions,()=>{
          act(()=>{const state=store.readAffirmations();const selected=!state.favorites.includes(item.id);store.chooseAffirmationFavorite(item.id,selected);return store.storage?(selected?'Saved to My Morning in this browser.':'Removed from My Morning.'):(selected?'Selected for this page only; not saved in this browser.':'Removed on this page only; the browser copy may remain.');});
        });heart.className='affirmation-heart';heart.setAttribute('aria-pressed',String(on));heart.setAttribute('aria-label',`Favorite: ${item.text}`);heart.title=on?'Remove from My Morning':'Save to My Morning';heart.dataset.affirmationId=item.id;heart.dataset.action='favorite';
        if(model.customId(item.id)){
          const editButton=button('Edit',actions,()=>edit(item,editButton));editButton.setAttribute('aria-label',`Edit: ${item.text}`);editButton.dataset.affirmationId=item.id;editButton.dataset.action='edit';
          const remove=button('Remove',actions,()=>act(()=>{const currentEpoch=store.affirmationConfig()?.epoch;if(!confirm('Remove this custom line and its My Morning favorite? Export a private backup first to keep a copy.'))return '';store.removeCustom(item,currentEpoch);return 'Custom line removed.';}));remove.setAttribute('aria-label',`Remove: ${item.text}`);remove.dataset.affirmationId=item.id;remove.dataset.action='remove';
        }
      });
      if(focusId&&focused&&!focused.isConnected){const replacement=[...list.querySelectorAll('button')].find(b=>b.dataset.affirmationId===focusId&&b.dataset.action===focusAction);(replacement||status).focus({preventScroll:true});}
      if(dialog.open&&(store.affirmationConfig()?.epoch??null)!==epoch){close();say('Saved local data changed in another tab. The unsaved editor was closed.');}
    }
    collection?.addEventListener('change',()=>{visible=PAGE;render();});
    search?.addEventListener('input',()=>{visible=PAGE;render();});category?.addEventListener('change',()=>{visible=PAGE;render();});
    root.querySelector('[data-affirmation-clear]')?.addEventListener('click',()=>{search.value='';category.value='';if(collection)collection.value='public';visible=PAGE;render();search.focus();});
    document.addEventListener('ocf-private-library-change',()=>{render();if(store.warning)say(lastMessage);});
    window.addEventListener('popstate',()=>{if(dialog.open)close();render();});window.addEventListener('pageshow',()=>{if(dialog.open)close();render();});
    root.querySelector('[data-affirmation-controls]').hidden=false;render();say('');
  }
  document.addEventListener('ocf-private-library-ready',start);start();
})();
