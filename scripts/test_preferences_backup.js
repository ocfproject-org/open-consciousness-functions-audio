const assert=require('node:assert/strict');
const {validate,LIMIT}=require('../site/assets/js/preferences-backup');
const good={schema:1,kind:'ocf-site-preferences',theme:'system',edition:'latest',format:'mp3'};
for(const theme of ['system','light','dark','black'])for(const edition of ['latest','0.1.0','0.2.0'])for(const format of ['mp3','flac'])assert.deepEqual(validate(JSON.stringify({...good,theme,edition,format}),['0.2.0','0.1.0']),{...good,theme,edition,format});
for(const value of [null,[],{...good,schema:2},{...good,kind:'progress'},{...good,theme:'pink'},{...good,edition:'0.0.1'},{...good,format:'wav'},{...good,url:'https://example.test/private'},{...good,tracking:true},{schema:1,records:[]}])assert.throws(()=>validate(JSON.stringify(value),['0.2.0','0.1.0']));
assert.throws(()=>validate('{',[]));assert.throws(()=>validate(' '.repeat(LIMIT+1),[]));
console.log('Settings backup: 48 valid combinations and strict malformed/schema/scope/size rejection passed.');
