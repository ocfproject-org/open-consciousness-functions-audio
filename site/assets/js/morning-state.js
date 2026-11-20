/* Saved guide text, never inferred from recording identity. No personal URLs. */
((root)=>{
'use strict';
const MAX=50, uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
const fail=()=>{throw Error('Unsupported or corrupt morning routine. Existing cues have not been replaced.');};
const exact=(x,keys)=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join('|')!==keys.sort().join('|'))fail();};
const text=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u001f\u007f]/u.test(x);
// Deliberately bounded public-source coverage. No aliases inferred as originals.
const historical=Object.freeze({
 'hplus-off-loading-1988':Object.freeze({title:'Off-Loading',text:'Plus Fade Fade',notation:'PLUS-FADE, FADE',source:'https://archive.org/details/function-off-loading',reference:'Human Plus Function Exercises booklet · Off-Loading · 88R1035'}),
 'hplus-attention-booklet':Object.freeze({title:'Attention',text:'Plus Focus',notation:'PLUS-FOCUS',source:'https://archive.org/details/hfunction-exercises-complete-booklet',reference:'Human Plus Function Exercises booklet · Attention'})
});
const roles=new Set(['activation','mode']);
function commands(guide){
 const fields=guide?.snapshot?.fields;if(!fields||guide.snapshot.schema!==1)return [];
 return Object.keys(fields).filter(k=>/^command\.OCF-CMD-[A-Z0-9-]+\.spoken_cue$/.test(k)).map(k=>{
  const command=k.slice(8,-11);return {command,text:fields[k],role:fields[`command.${command}.role`]};
 }).filter(c=>roles.has(c.role)&&text(c.text,500));
}
function validate(rows,subjects){
 if(!Array.isArray(rows)||rows.length>MAX||new TextEncoder().encode(JSON.stringify(rows)).length>1024*1024)fail();const ids=new Set();
 for(const row of rows){
  if(!row||!uuid(row.id)||ids.has(row.id))fail();ids.add(row.id);
  if(row.kind==='custom'){exact(row,['id','kind','text']);if(!text(row.text,500))fail();}
  else if(row.kind==='hplus'){exact(row,['id','kind','command','text']);if(typeof row.command!=='string'||!Object.hasOwn(historical,row.command)||row.text!==historical[row.command].text)fail();}
  else {
   exact(row,['id','kind','subject','command','guide','origin']);
   if(row.kind!=='function'||typeof row.subject!=='string'||!/^OCF-[A-Z]{3}-\d{3}$/.test(row.subject)||!Object.hasOwn(subjects,row.subject)||!['learned','current'].includes(row.origin))fail();
   exact(row.guide,['commit','locale','fingerprint','snapshot']);
   if(typeof row.guide.commit!=='string'||!/^[a-f0-9]{40}$/.test(row.guide.commit)||typeof row.guide.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(row.guide.fingerprint)||!text(row.guide.locale,32))fail();
   exact(row.guide.snapshot,['schema','fields']);
   if(!row.guide.snapshot.fields||typeof row.guide.snapshot.fields!=='object'||Array.isArray(row.guide.snapshot.fields)||JSON.stringify(row.guide).length>64000||Object.keys(row.guide.snapshot.fields).length>256)fail();
   if(typeof row.command!=='string'||!row.command.startsWith('OCF-CMD-'+row.subject.slice(4)+'-')||!commands(row.guide).some(c=>c.command===row.command))fail();
  }
 }
 return rows;
}
async function verify(rows,subjects,validateRecord){
 validate(rows,subjects);
 for(const row of rows)if(row.kind==='function')await validateRecord({id:row.id,subject:row.subject,markedAt:'2026-01-01T00:00:00.000Z',guide:row.guide,recording:null,external:null},subjects);
 return rows;
}
const cue=row=>row.kind==='custom'||row.kind==='hplus'?row.text:commands(row.guide).find(c=>c.command===row.command)?.text;
const eligible=(row,subjects)=>row.kind==='custom'||(row.kind==='hplus'&&Object.hasOwn(historical,row.command)&&row.text===historical[row.command].text)||commands(subjects[row.subject]?.guide).some(c=>c.command===row.command&&c.role===commands(row.guide).find(x=>x.command===row.command)?.role);
// Same command and wording across guide revisions is one choice. Roles and IDs
// remain distinct; identical words from different systems retain labelled origins.
const wording=value=>value?.normalize('NFC').toLowerCase().trim().replace(/\s+/g,' ');
function choiceKey(row){
 const originalFocus=row.kind==='hplus'&&row.command==='hplus-attention-booklet';
 const ocfFocus=row.kind==='function'&&row.command==='OCF-CMD-FND-002-PRIMARY'&&row.guide.locale==='en-US'&&wording(cue(row))==='plus focus';
 if(originalFocus||ocfFocus)return 'shared:focus:plus focus';
 if(row.kind==='function')return JSON.stringify([row.kind,row.subject,row.command,row.guide.locale,wording(cue(row))]);
 if(row.kind==='hplus')return JSON.stringify([row.kind,row.command,row.text]);
 return null;
}
async function merge(existing,incoming,subjects,digest,canonical){
 validate(existing,subjects);validate(incoming,subjects);
 const result=structuredClone(existing), content=row=>canonical(Object.fromEntries(Object.entries(row).filter(([k])=>k!=='id')));
 for(const row of incoming){
  if(result.some(x=>x.id===row.id&&content(x)===content(row)))continue;
  let id=row.id;if(result.some(x=>x.id===id)){const hash=await digest(row);id=`${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;}
  if(result.some(x=>x.id===id&&content(x)===content(row)))continue;
  if(result.some(x=>x.id===id))fail();result.push({...structuredClone(row),id});
 }
 return validate(result,subjects);
}
const backupSchema=rows=>rows?.some(row=>row.kind==='hplus')?5:4;
const api={backupSchema,MAX,uuid,historical,choiceKey,commands,validate,verify,cue,eligible,merge};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ocfMorningState=api;
})(globalThis);
