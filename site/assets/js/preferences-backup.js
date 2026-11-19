/* Explicit local settings files. Progress/consent have a separate backup scope. */
(() => {
  'use strict';
  const LIMIT = 16384;
  function validate(text, editions) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > LIMIT) throw Error('Settings backup exceeds 16 KiB.');
    let value; try { value = JSON.parse(text); } catch (_) { throw Error('Invalid settings JSON.'); }
    if (!value || Array.isArray(value) || Object.keys(value).sort().join('|') !== 'edition|format|kind|schema|theme' || value.schema !== 1 || value.kind !== 'ocf-site-preferences' || !['system','light','dark','black'].includes(value.theme) || !['mp3','flac'].includes(value.format) || !['latest',...editions].includes(value.edition)) throw Error('Unsupported or invalid settings backup. No settings changed.');
    return value;
  }
  if (typeof module !== 'undefined') module.exports = {validate, LIMIT};
  if (typeof document === 'undefined') return;
  const preferences = document.getElementById('preferences');
  const edition = document.getElementById('edition-filter'), format = document.getElementById('format-filter'), theme = document.querySelector('[data-theme-toggle]');
  if (!preferences || !edition || !format || !theme) return;
  const versions = () => [...edition.options].map(option => option.value);
  const node = (tag,text,parent) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent?.append(n);return n;};
  const section=node('details',undefined,preferences);section.className='personal-settings preferences-backup';
  node('summary','Site settings backup',section);
  node('p','Export or restore theme, audio edition and preferred format. Private library marks and tracking consent are separate and remain unchanged. Search, playback and URLs are excluded. Files stay on your device; nothing is uploaded.',section);
  const notice=node('p','',section);notice.setAttribute('role','status');
  const button=(label,action)=>{const b=node('button',label,section);b.type='button';b.addEventListener('click',action);return b;};
  const current=()=>({schema:1,kind:'ocf-site-preferences',theme:theme.dataset.themePreference||'system',edition:edition.value,format:format.value});
  button('Export site settings',()=>{
    const value=validate(JSON.stringify(current()),versions());const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
    const a=node('a');a.href=url;a.download='ocf-site-settings-v1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice.textContent='Site settings downloaded. Private library data was not included.';
  });
  const label=node('label','Import site settings (JSON, up to 16 KiB)',section);const input=node('input',undefined,label);input.type='file';input.accept='.json,application/json';
  const preview=node('p','',section);let pending=null,generation=0;
  const confirm=button('Confirm settings import',()=>{
    if(!pending)return;
    try {
      const value=validate(JSON.stringify(pending),versions());
      // Use the existing controllers, retaining their playback and storage behavior.
      for(let i=0;i<4&&theme.dataset.themePreference!==value.theme;i++)theme.click();
      edition.value=value.edition;edition.dispatchEvent(new Event('change',{bubbles:true}));
      format.value=value.format;format.dispatchEvent(new Event('change',{bubbles:true}));
      clear();notice.textContent='Site settings applied. Private library and tracking consent unchanged. Browser storage availability determines whether settings persist.';
    } catch(error) {clear();notice.textContent=error.message;}
  });
  const cancel=button('Cancel settings import',()=>{clear();notice.textContent='Settings import cancelled. No settings changed.';input.focus();});
  function clear(){pending=null;generation++;preview.textContent='';confirm.hidden=true;cancel.hidden=true;input.value='';}
  clear();
  input.addEventListener('change',async()=>{
    const file=input.files[0],turn=++generation;pending=null;preview.textContent='';confirm.hidden=true;cancel.hidden=true;if(!file)return;
    try {
      if(file.size>LIMIT)throw Error('Settings backup exceeds 16 KiB.');
      const value=validate(await file.text(),versions());if(turn!==generation)return;
      pending=value;preview.textContent=`Preview: theme ${value.theme}; audio edition ${value.edition}; format ${value.format.toUpperCase()}. Confirm to replace these three settings only.`;
      confirm.hidden=false;cancel.hidden=false;notice.textContent='Validated. Nothing changes until you confirm.';
    }catch(error){if(turn===generation)notice.textContent=error.message;}
  });
  preferences.addEventListener('close',clear);
})();
