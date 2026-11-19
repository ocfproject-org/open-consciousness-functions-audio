// Synthetic scale fixture only. Never imported by the site build.
module.exports = original => ({categories:original.categories,lines:[
 ...Array.from({length:743},(_,i)=>({id:`public:synthetic-${String(i).padStart(4,'0')}`,category:Object.keys(original.categories)[i%12],text:i===0?original.lines.find(x=>x.id.startsWith('starter:')).text:`Synthetic public phrase ${String(i).padStart(4,'0')} — café 東京`,subtopic:`Synthetic topic ${i%4}`})),
 ...original.lines.filter(x=>x.id.startsWith('starter:')).map(line=>({...line,archived:true})),
]});
