import {flacInteger,rebase} from './virtual-flac.mjs';
const from64=s=>Uint8Array.from(atob(s),ch=>ch.charCodeAt(0));
const to64=b=>btoa(Array.from(b,ch=>String.fromCharCode(ch)).join(''));
export function compose(index, params) {
  if (!params.size) throw Error('Original does not need an edit');
  const windows=[], bookmarks=[], seen=new Set(), spans=[], seek=[];
  let cursor=0, count=0, offset=0, delta=0, low=65535, high=0, previousSize=0;
  for(const ck of index.checks) {
    const choice=params.get(ck.control);
    if(!choice) continue;
    const edit=Object.hasOwn(ck.options,choice) && ck.options[choice];
    if(!edit||params.getAll(ck.control).length!==1) throw Error('Unverified choice');
    seen.add(ck.control);windows.push(edit);
    bookmarks.push({control:ck.control,at:(ck.start+delta)/index.rate});
    delta+=edit.frames;
  }
  if(seen.size!==params.size)throw Error('Unknown choice');
  function emit(rows, start=0, finish=rows.length) {
    for(let i=start;i<finish;i++) {
      const [asset,ptr,size,block,len]=rows[i];
      const length=size+flacInteger(count).length-len;
      if(length<=0||block<1||block>65535)throw Error('Bad range geometry');
      if(!seek.length||count-seek.at(-1)[0]>=index.rate)seek.push([count,offset,block]);
      if(asset===-1) {
        const frame=rebase(from64(ptr),count,block);
        if(frame.length!==length)throw Error('Bad fragment size');
        spans.push([offset,-1,to64(frame),0,block,count,length]);
      } else spans.push([offset,asset,ptr,size,block,count,length]);
      count+=block;offset+=length;
      high=Math.max(high,block);
      if(previousSize)low=Math.min(low,previousSize);
      previousSize=block;
    }
  }
  for(const w of windows) {
    if(w.from<cursor||w.from>w.to||w.to>index.master.length)throw Error('Overlapping splice windows');
    emit(index.master,cursor,w.from);emit(w.packets);cursor=w.to;
  }
  emit(index.master,cursor);
  if(!count||count>=2**36)throw Error('Bad sample count');
  low=Math.max(16,low===65535?high:low);high=Math.max(16,high);
  if(low===high){if(low>16)low--;else high++;}
  const table=18*seek.length, header=new Uint8Array(46+table), dv=new DataView(header.buffer);
  header.set([102,76,97,67,0,0,0,34]);dv.setUint16(8,low);dv.setUint16(10,high);
  dv.setBigUint64(18,(BigInt(index.rate)<<44n)|(1n<<41n)|(15n<<36n)|BigInt(count));
  dv.setUint32(42,0x83000000|table);
  seek.forEach(([sample,bytes,block],n)=>{
    const i=46+18*n;
    dv.setBigUint64(i,BigInt(sample));dv.setBigUint64(i+8,BigInt(bytes));dv.setUint16(i+16,block);
  });
  return {revision:index.revision,bytes:header.length+offset,header:to64(header),spans,seconds:count/index.rate,bookmarks};
}
