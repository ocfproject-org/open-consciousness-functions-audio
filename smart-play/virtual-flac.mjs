/* Wire-only FLAC packet relay. No PCM decoder or complete alternate recordings. */
const lut=(bits,poly)=>Array.from({length:256},(_,i)=>{
 let x=i<<(bits-8);for(let j=0;j<8;j++)x=((x<<1)&((1<<bits)-1))^((x>>(bits-1))?poly:0);
 return x;
});
const crc8=lut(8,7),crc16=lut(16,0x8005);
function crc(data,bits){
 let tag=0;
 if(bits===8)for(const b of data)tag=crc8[b^tag];
 else for(const b of data)tag=((tag<<8)&65535)^crc16[b^(tag>>>8)];
 return tag;
}
export function flacInteger(value){
 if(value<128)return [value];
 for(let n=2;n<8;n++)if(value<2**(5*n+1)){
   const d=[256-(1<<(8-n))+Math.floor(value/2**(6*(n-1)))];
   for(let i=n-2;i>=0;i--)d.push(128+Math.floor(value/2**(6*i))%64);
   return d;
 }
 throw Error('Unsupported sample position');
}
export function rebase(old,position,samples){
 const first=old[4],typ=old[2]>>>4,hz=old[2]&15;
 if(old.length<10||old[0]!==255||![248,249].includes(old[1])||(old[3]&1)||!typ)throw Error('Bad FLAC frame');
 const bytes=first<128?1:[2,3,4,5,6,7].find(n=>!(first&(128>>n)));
 const extra=typ===6?1:typ===7?2:0, idx=4+bytes;
 const block=typ===6?old[idx]+1:typ===7?(old[idx]*256+old[idx+1]+1):typ>=8?(256<<(typ-8)):typ>=2?(576<<(typ-2)):192;
 const end=idx+extra+(hz===12?1:hz===13||hz===14?2:0);
 if(!bytes||end>=old.length-2||block!==samples||crc(old.subarray(0,end),8)!==old[end]||
    crc(old.subarray(0,-2),16)!==old[old.length-2]*256+old[old.length-1])throw Error('Packet does not match verified index');
 const next=flacInteger(position), h=Uint8Array.from([255,249,old[2],old[3],...next,...old.subarray(idx,end)]);
 const out=new Uint8Array(old.length+next.length-bytes);
 out.set(h);out[h.length]=crc(h,8);out.set(old.subarray(end+1,-2),h.length+1);
 const f=crc(out.subarray(0,-2),16);out[out.length-2]=f>>>8;out[out.length-1]=f&255;
 return out;
}
const binary=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
const CLAMP=1024*1024;
function parseRange(value,size){
 if(!value)return [200,0,size-1];
 const m=/^bytes=(\d{0,15})-(\d{0,15})$/.exec(value);
 if(!m||!(m[1]||m[2]))return null;
 const a=m[1]?+m[1]:Math.max(0,size-(+m[2])),b=m[1]&&m[2]?Math.min(size-1,+m[2]):size-1;
 return a<=b?[206,a,b]:null;
}
function lowerSpan(spans,pos){
 let a=0,b=spans.length;
 while(a<b){const m=(a+b)>>1;if(spans[m][0]>pos)b=m;else a=m+1;}
 return Math.max(0,a-1);
}
export function routeResponse(req,recipe,inventory,dataURL,fetcher=fetch){
 const head=binary(recipe.header),range=parseRange(req.headers.get('Range'),recipe.bytes);
 const common={'Accept-Ranges':'bytes','Content-Type':'audio/flac','Cache-Control':'no-store'};
 if(!range)return new Response(null,{status:416,headers:{...common,'Content-Range':'bytes */'+recipe.bytes}});
 const [status,start,end]=range;
 const headers={...common,'Content-Length':String(end-start+1)};
 if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${recipe.bytes}`;
 if(req.method==='HEAD')return new Response(null,{status,headers});
 const spans=recipe.spans, lo=start-head.length, hi=end+1-head.length;
 let i=lowerSpan(spans,lo),sendHeader=start<head.length, block=null, cancel=new AbortController();
 const stream=new ReadableStream({
  async pull(controller){
   if(sendHeader){sendHeader=false;controller.enqueue(head.subarray(start,Math.min(end+1,head.length)));return;}
   if(i>=spans.length||spans[i][0]>=hi){controller.close();return;}
   const [out,asset,offset,sourceSize,sampleSize,at,size]=spans[i++];
   let frame;
   if(asset===-1)frame=binary(offset);
   else {
     if(!Object.hasOwn(inventory,asset))throw Error('Unknown source asset');
     if(!block||block.asset!==asset||block.from>offset||block.until<offset+sourceSize){
       let until=offset+sourceSize;
       for(let j=i;j<spans.length&&spans[j][0]<hi;j++){
         const [,key,off,n]=spans[j];if(key!==asset||off!==until||off+n-offset>CLAMP)break;
         until=off+n;
       }
       const info=inventory[asset], first=Math.floor(offset/CLAMP), last=Math.floor((until-1)/CLAMP);
       if(typeof info.url!=='string'||!Array.isArray(info.chunks))throw Error('Missing immutable media proof');
       const aligned=first*CLAMP, stop=Math.min(info.bytes,(last+1)*CLAMP);
       const reply=await fetcher(new URL(info.url,dataURL),{
         headers:{Range:'bytes='+aligned+'-'+(stop-1)},cache:'no-cache',credentials:'omit',redirect:'error',signal:cancel.signal
       });
       if(reply.status!==206){if(reply.body)await reply.body.cancel();throw Error('Media range unavailable');}
       const reported=reply.headers.get('Content-Range');
       if(reported!==null&&reported!=='bytes '+aligned+'-'+(stop-1)+'/'+info.bytes){
         if(reply.body)await reply.body.cancel();throw Error('Unverified media range');
       }
       const data=new Uint8Array(await reply.arrayBuffer());
       if(data.length!==stop-aligned)throw Error('Wrong range length');
       for(let i=first;i<=last;i++){
         const part=data.subarray((i-first)*CLAMP,(i-first+1)*CLAMP);
         const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',part)),v=>v.toString(16).padStart(2,'0')).join('');
         if(digest!==info.chunks[i])throw Error('Media chunk differs from its released checksum');
       }
       block={asset,from:aligned,until:stop,data};
     }
     frame=rebase(block.data.subarray(offset-block.from,offset-block.from+sourceSize),at,sampleSize);
   }
   if(frame.length!==size)throw Error('Wire size differs from approved plan');
   controller.enqueue(frame.subarray(Math.max(0,lo-out),Math.min(size,hi-out)));
  },
  cancel(){cancel.abort();}
 });
 return new Response(stream,{status,headers});
}
