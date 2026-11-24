const test = require('node:test');
const assert = require('node:assert/strict');
const {boot, html} = require('./helpers/kol-fixture.cjs');
test('actual CSV download neutralizes formula text after whitespace and controls without altering numeric cells', async () => {
 const b=boot(), blobs=[], revoked=[], links=[];
 b.ctx.Blob=Blob;
 b.ctx.URL={createObjectURL(blob){blobs.push(blob);return 'blob:csv-test';},revokeObjectURL(url){revoked.push(url);}};
 const create=b.ctx.document.createElement;
 b.ctx.document.createElement=tag=>{const node=create(tag);node.click=()=>links.push({href:node.href,download:node.download});return node;};
 const payloads=['=HYPERLINK("https://example.test","click")',' \t\u0000=1+1','+SUM(1,2)','-2+3','@SUM(1,2)','\uFEFF\r\n@evil','\u200B=1+1'];
 b.ctx.exportRecords=payloads.map((bioText,i)=>({handle:'@safe'+i,snapshotId:'csv'+i,bioText,ageGroup:'\t=1+1',specialistSkincareStores:2,skincareSkuCount:3,scorePct:80}));
 b.run('saveHistoryArray(exportRecords);downloadSelectedExport("csv")');
 assert.equal(blobs.length,1);
 assert.equal(blobs[0].type,'text/csv;charset=utf-8');
 const csv=await blobs[0].text();
 const rows=csv.replace(/^\uFEFF/,'').split('\n').map(line=>[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(m=>m[1].replace(/""/g,'"')));
 assert.equal(rows.length,payloads.length+1);
 assert.ok(rows.every(row=>row.length===13),'quoted commas and doubled quotes must remain valid CSV cells');
 for(const cells of rows.slice(1)) {
   assert.ok(cells[3].startsWith("'"),'formula-like bio must be stored as text: '+JSON.stringify(cells[3]));
   assert.ok(cells[8].startsWith("'"),'formula-like age must be stored as text');
   assert.ok(cells[1].startsWith("'@safe"),'handles beginning @ are text too');
   assert.equal(cells[9],'2'); assert.equal(cells[10],'3');
 }
 assert.ok(rows[1][3].includes('HYPERLINK("https://example.test","click")'));
 assert.deepEqual(revoked,['blob:csv-test']);
 assert.equal(links.length,1);assert.match(links[0].download,/\.csv$/);
 // Sink-level numeric defense: actual numbers must not gain an apostrophe.
 b.ctx.exportRecords=[{handle:'@numeric',snapshotId:'numeric',specialistSkincareStores:-2,skincareSkuCount:3}];
 b.run('getExportItems=()=>exportRecords;downloadSelectedExport("csv")');
 const numericCsv=await blobs[1].text();
 assert.ok(numericCsv.includes(',"-2","3",'));
});

function historyImport(b, records) {
 const reads=[];
 b.ctx.FileReader=class {readAsText(){reads.push(this);}};
 b.run('importHistoryJson({target:{files:[{size:100,name:"backup.json"}]}})');
 reads[0].onload({target:{result:JSON.stringify(records)}});
}
test('actual history backup import rejects executable strings in numeric snapshot fields',()=>{
 for(const field of ['scorePct','specialistSkincareStores','skincareSkuCount']) {
  const b=boot();
  historyImport(b,[{handle:'@safe',snapshotId:'attack',savedAtIso:'2026-01-01T00:00:00Z',[field]:'<img src=x onerror=alert(1)>'}]);
  assert.equal(b.run('getSavedHistory().length'),0,field+' must be rejected before storage/rendering');
  assert.doesNotMatch(b.elements.get('historyTableBody')?.children.map(c=>c.innerHTML).join('')||'',/<img\b/i);
 }
});
test('history import validates every snapshot before deduplication',()=>{
 const b=boot();
 historyImport(b,[{handle:'@safe',snapshotId:'valid',scorePct:80},{handle:'@safe',snapshotId:'invalid',scorePct:'<svg onload=alert(1)>'}]);
 assert.equal(b.run('getSavedHistory().length'),0,'a malformed duplicate must reject the backup atomically');
});
test('history and comparison renderers escape nominal numeric values defensively',()=>{
 const b=boot(), attack='<img src=x onerror=alert(1)>';
 historyImport(b,[{handle:'@safe',snapshotId:'safe',scorePct:80,specialistSkincareStores:2,skincareSkuCount:3}]);
 assert.equal(b.run('getSavedHistory().length'),1,'valid backup still imports');
 const record=JSON.parse(b.run('JSON.stringify(getSavedHistory()[0])'));
 for(const field of ['scorePct','specialistSkincareStores','skincareSkuCount','savedAtFormatted','dateRangeWindow','ageGroup']) record[field]=attack;
 record.top20MatchedBrands=[attack];
 // Exercise sink-level defense independently of the boundary validator.
 b.ctx.records=[record]; b.run('getSavedHistory=()=>records; renderHistoryTable(); renderComparisonView()');
 for(const output of [b.elements.get('historyTableBody').children.at(-1).innerHTML,b.elements.get('comparisonContent').innerHTML]) {
  assert.doesNotMatch(output,/<img\b/i);
  assert.match(output,/&lt;img/);
 }
});
async function delayedImportEnvironment() {
 const b=boot(), reads=[], timers=[]; let authChanged;
 const auth={currentUser:null,onAuthStateChanged(fn){authChanged=fn;}};
 b.ctx.firebase={initializeApp:()=>({auth:()=>auth})};
 b.ctx.FileReader=class {readAsText(){reads.push(this);}};
 b.ctx.setTimeout=fn=>timers.push(fn);
 b.run('loadScriptOnce=async()=>{}; WISHPLAN_FIREBASE_CONFIG={apiKey:"public",authDomain:"example.test",projectId:"test",appId:"public"}');
 await b.run('initFirebase()');
 const switchUser=uid=>{auth.currentUser=uid ? {uid} : null; authChanged();};
 switchUser('alice');
 return {...b,reads,timers,switchUser};
}
for(const boundary of ['bob','switch-back','guest']) test('delayed history import cancels at auth boundary: '+boundary,async()=>{
 const b=await delayedImportEnvironment();
 b.run('importHistoryJson({target:{files:[{size:100,name:"backup.json"}]}})');
 b.switchUser(boundary==='guest' ? null : 'bob');
 if(boundary==='switch-back') b.switchUser('alice');
 const before=JSON.stringify([...b.storage]);
 b.reads[0].onload({target:{result:JSON.stringify([{handle:'@alice',snapshotId:'private'}])}});
 assert.equal(JSON.stringify([...b.storage]),before,'stale import must not write any owner storage');
 assert.equal(b.run('currentAuditData'),null);
});
function stubEmptyHtmlParser(b) {
 b.ctx.DOMParser=class {parseFromString(){return {querySelector:()=>null,querySelectorAll:()=>[],body:{textContent:''}};}};
}
for(const boundary of ['bob','switch-back','guest']) test('delayed HTML file read cancels at auth boundary: '+boundary,async()=>{
 const b=await delayedImportEnvironment(); stubEmptyHtmlParser(b);
 b.run('handleFileSelect({target:{files:[{size:100,name:"private.html"}]}})');
 b.switchUser(boundary==='guest' ? null : 'bob');
 if(boundary==='switch-back') b.switchUser('alice');
 const before=JSON.stringify([...b.storage]);
 b.reads[0].onload({target:{result:'<html></html>'}});
 b.timers.forEach(fn=>fn());
 assert.equal(JSON.stringify([...b.storage]),before,'stale HTML read must not save into another session');
 assert.equal(b.run('currentAuditData'),null,'stale HTML read must not restore private dashboard');
});
for(const source of ['file','paste']) test('outstanding HTML transition callbacks cancel after switch-back: '+source,async()=>{
 const b=await delayedImportEnvironment(); stubEmptyHtmlParser(b);
 if(source==='file') {
  b.run('readAndAuditFile({size:100,name:"private.html"})');
  b.reads[0].onload({target:{result:'<html></html>'}});
 } else b.run('document.getElementById("rawHtmlInput").value="<html></html>"; handleRawHtmlSubmit()');
 assert.equal(b.run('getSavedHistory().length'),1);
 assert.equal(b.timers.length,5,'exercise all progress and final-render timers');
 b.switchUser('bob'); b.switchUser('alice');
 const before=JSON.stringify([...b.storage]), width=b.elements.get('loadingBar').style.width;
 b.timers.forEach(fn=>fn());
 assert.equal(b.run('currentAuditData'),null,'old session must not reappear after auth reset');
 assert.equal(b.elements.get('loadingBar').style.width,width,'stale progress callbacks must also cancel');
 assert.equal(JSON.stringify([...b.storage]),before);
});
test('unchanged owner can finish delayed history and HTML imports',async()=>{
 const b=await delayedImportEnvironment(); stubEmptyHtmlParser(b);
 b.run('importHistoryJson({target:{files:[{size:100,name:"backup.json"}]}})');
 b.reads[0].onload({target:{result:JSON.stringify([{handle:'@alice',snapshotId:'private'}])}});
 assert.equal(b.run('getSavedHistory()[0].handle'),'@alice');
 b.run('readAndAuditFile({size:100,name:"private.html"})');
 b.reads[1].onload({target:{result:'<html></html>'}});
 b.timers.forEach(fn=>fn());
 assert.equal(b.run('currentAuditData.handle'),'@unknown_creator');
 assert.equal(b.run('getSavedHistory().length'),2);
});
test('empty bundle has no invented demographics, health, MCN or compatibility',()=>{
 const b=boot(); const d=b.run('parseKalodataApiBundle({})');
 for(const key of ['ageGroup','isFemaleMajority','isIndependent','followerChange','aov','videoGmv','videoCount30d']) assert.equal(d[key],null,key);
 assert.match(d.detectedIndustry,/unknown|insufficient/i);
 assert.equal(b.run('computeOverallScorePct(parseKalodataApiBundle({}))'),null);
 const list=b.run('buildDynamicChecklist(parseKalodataApiBundle({}))');
 assert.equal(list.filter(i=>i.passed===true).length,0);
 assert.ok(list.every(i=>i.available===false));
 b.ctx.empty=d; b.run('renderDashboard(empty)');
 assert.match(b.elements.get('overallChecksText').textContent,/coverage/i);
 assert.equal(b.elements.get('overallScoreValue').textContent,'N/A');
 assert.match(b.elements.get('scenarioTitle').textContent,/insufficient/i);
});
test('missing count is not inferred from a paginated video sample; gender substring is exact',()=>{
 const b=boot(); const d=b.run('parseKalodataApiBundle({creatorDetail:{followerSex:"male"},videos:[{title:"one"}],coreMetrics:{revenue:1000,video_revenue:500,followers:0}})');
 assert.equal(d.isFemaleMajority,false); assert.equal(d.videoCount30d,null); assert.equal(d.gmvPerVideo,null);
 assert.equal(d.followersCount,null); assert.equal(d.followerChange,0);
});
test('criterion labels disclose actual operational thresholds',()=>{
 const b=boot(); const list=b.run('buildDynamicChecklist({...parseKalodataApiBundle({}),dominantTrack:"VIDEO_TRACK"})');
 assert.match(list.find(i=>i.id==='c1_gender').label,/majority/i);
 assert.doesNotMatch(list.find(i=>i.id==='c1_gender').label,/70%/);
 assert.match(list.find(i=>i.id==='c2_unit_output').threshold,/15/);
 assert.match(list.find(i=>i.id==='c3_top20').threshold,/30/);
 assert.doesNotMatch(list.find(i=>i.id==='c4_mcn').threshold,/6M/);
});
test('unsafe cross-window import path is disabled; messages cannot mutate history',()=>{
 const b=boot();
 assert.equal(b.listeners.message,undefined);
 assert.equal(b.elements.get('kalodataBookmarkletLink').href,'#');
 assert.match(b.elements.get('kalodataBookmarkletLink').textContent,/disabled/i);
 assert.throws(()=>b.run('buildKalodataInPageExtractorCode("https://example.test")'),/disabled/i);
});
test('bundle boundaries reject oversized, malformed, executable text and unsafe history IDs',()=>{
 const b=boot();
 b.ctx.bad={creatorDetail:{handle:5}}; assert.throws(()=>b.run('parseKalodataApiBundle(bad)'),/invalid/i);
 b.ctx.bad={creatorDetail:{handle:'x'.repeat(300)}}; assert.throws(()=>b.run('parseKalodataApiBundle(bad)'),/limit|invalid/i);
 b.ctx.bad={shops:Array.from({length:201},()=>({}))}; assert.throws(()=>b.run('parseKalodataApiBundle(bad)'),/limit|invalid/i);
 assert.throws(()=>b.run('parseFirebaseConfig("({projectId: (globalThis.pwned=true)})")'));
 assert.equal(b.ctx.pwned,undefined);
});
test('local histories are UID-separated and owner deletion hides a snapshot permanently',async()=>{
 const b=boot(); b.run('saveHistoryArray([{handle:"@guest",snapshotId:"guest"}])');
 b.run('fbApp={auth:()=>({currentUser:{uid:"user-a"}})}');
 assert.equal(b.run('getSavedHistory().length'),0);
 b.run('saveHistoryArray([{handle:"@a",snapshotId:"a"}])');
 b.run('fbApp={auth:()=>({currentUser:{uid:"user-b"}})}');
 assert.equal(b.run('getSavedHistory().length'),0);
 b.run('fbApp=null'); assert.equal(b.run('getSavedHistory()[0].handle'),'@guest');
 b.run('deleteSnapshotFromHistory("guest")');
 assert.ok(b.run('deletedIds().has("guest")'));
 b.run('saveHistoryArray([{handle:"@guest",snapshotId:"guest"}])');
 assert.equal(b.run('getSavedHistory().length'),0);
});
test('callable request matches backend prompt contract and never invents live research',async()=>{
 const b=boot(); const calls=[];
 b.ctx.app={auth:()=>({currentUser:{uid:'owner'}}),functions:region=>({httpsCallable:name=>async payload=>{calls.push({region,name,payload});return {data:{text:'server analysis'}};}})};
 b.run('WISHPLAN_FIREBASE_CONFIG={apiKey:"public",authDomain:"example.test",projectId:"test",appId:"public"};WISHPLAN_KOL_AI_ENABLED=true;WISHPLAN_FIREBASE_APPCHECK_SITE_KEY="public-site-key";fbApp=app;firebaseReady=Promise.resolve(app);currentAuditData=parseKalodataApiBundle({creatorDetail:{handle:"tester"}})');
 await b.run('runAiDeepCaseAnalysis()');
 assert.equal(calls.length,1); assert.equal(calls[0].name,'analyzeKol');
 assert.deepEqual(Object.keys(calls[0].payload),['prompt']);
 assert.match(calls[0].payload.prompt,/L\.ASY/);
 assert.match(calls[0].payload.prompt,/missing|unknown/i);
 assert.equal(b.elements.get('aiAuditOutput').textContent,'server analysis');
});
test('cloud push cannot report success when explicit deletion fails',async()=>{
 const b=boot(); let writes=0;
 const db={collection:()=>({doc:()=>({collection:()=>({doc:()=>({set:async()=>{throw Error('denied')},get:async()=>({exists:false})})})})}),runTransaction:async fn=>fn({get:async()=>{throw Error('denied')},set:()=>{writes++}})};
 b.ctx.app={auth:()=>({currentUser:{uid:'owner'}}),firestore:()=>db};
 b.run('WISHPLAN_FIREBASE_CONFIG={apiKey:"public",authDomain:"example.test",projectId:"test",appId:"public"};fbApp=app;firebaseReady=Promise.resolve(app);rememberDeletion(["gone"])');
 await b.run('cloudPushAll(false)');
 assert.match(b.elements.get('authSyncStatus').textContent,/error|pending/i);
 assert.equal(writes,0);
});
test('HTML parser leaves missing fields unknown and dashboard names unknowns',()=>{
 const b=boot(); b.ctx.DOMParser=class {parseFromString(){return {querySelector:()=>null,querySelectorAll:()=>[],body:{textContent:''}};}};
 const d=b.run('parseKalodataHtml("<html></html>")');
 for(const k of ['ageGroup','isIndependent','isFemaleMajority','followerChange','videoCount30d','totalGmv']) assert.equal(d[k],null,k);
 b.ctx.empty=d; b.run('renderDashboard(empty)');
 assert.match(b.elements.get('trackModeBadge').textContent,/unknown/i);
 assert.match(b.elements.get('kolDemographics').textContent,/unknown/i);
 assert.match(b.elements.get('metricAovFit').textContent,/missing|unknown|N\/A/i);
 assert.equal(b.run('formatDeltaBadge(null,100)'),'<span>N/A — missing comparison data</span>');
});
test('untrusted source strings render escaped, unsafe backup IDs are rejected',()=>{
 const b=boot(); b.ctx.raw={creatorDetail:{handle:'safe'},shops:[{name:'<img src=x onerror=alert(1)>',revenue:10}],products:[{title:'<svg onload=alert(1)>',revenue:10}]};
 b.run('renderDashboard(parseKalodataApiBundle(raw))');
 // Inspect output of the real renderers, not only the escaping utility.
 assert.doesNotMatch(b.elements.get('storesTableBody').children[0].innerHTML,/<img/);
 assert.match(b.elements.get('storesTableBody').children[0].innerHTML,/&lt;img/);
 assert.doesNotMatch(b.elements.get('productsTableBody').children[0].innerHTML,/<svg/);
 assert.throws(()=>b.run('saveHistoryArray([{handle:"@safe",snapshotId:"bad\\\' onclick=evil"}])'),/invalid/i);
 assert.equal(b.run('escapeHtml("<img onerror=bad>\\\"\\\'")'),'&lt;img onerror=bad&gt;&quot;&#39;');
});
test('missing ad, store revenue and order evidence never becomes organic or evaluable depth',()=>{
 const b=boot(); const d=b.run('parseKalodataApiBundle({creatorDetail:{handle:"safe"},shops:[{name:"L.ASY"},{name:"CeraVe"}]})');
 assert.equal(d.avgRoas,null);
 assert.equal(d.stores[0].orders,null);
 b.ctx.partial=d;
 const list=b.run('buildDynamicChecklist(partial)');
 assert.equal(list.find(i=>i.id==='c3_top20').available,false);
 assert.equal(list.find(i=>i.id==='c3_sku_depth').available,false);
});
test('invalid JSON import stops instead of silently auditing it as HTML',()=>{
 const b=boot(); b.elements.get('rawHtmlInput')?.value;
 b.run('document.getElementById("rawHtmlInput").value=\'{"creatorDetail":{"handle":123}}\'; runStageTransitionAndAudit=()=>{throw Error("unsafe HTML fallback")}; handleRawHtmlSubmit()');
 assert.equal(b.run('getSavedHistory().length'),0);
});
test('owner sync writes only its UID and a remote tombstone defeats a stale upload',async()=>{
 const b=boot(), docs=new Map(), paths=[]; let mutations=0;
 const collection=base=>({doc:id=>{
  const path=base+'/'+id; paths.push(path);
  return {path,collection:name=>collection(path+'/'+name),set:async value=>{mutations++;return docs.set(path,value)},get:async()=>({exists:docs.has(path),data:()=>docs.get(path)})};
 },get:async()=>({docs:[...docs].filter(([k])=>k.startsWith(base+'/')).map(([k,v])=>({id:k.split('/').at(-1),data:()=>v}))})});
 const db={collection:name=>collection(name),runTransaction:async fn=>fn({get:ref=>ref.get(),set:(ref,value)=>{mutations++;return docs.set(ref.path,value)}})};
 b.ctx.app={auth:()=>({currentUser:{uid:'owner-uid'}}),firestore:()=>db};
 b.run('WISHPLAN_FIREBASE_CONFIG={apiKey:"public",authDomain:"example.test",projectId:"test",appId:"public"};fbApp=app;firebaseReady=Promise.resolve(app);saveHistoryArray([{handle:"@safe",snapshotId:"one"}])');
 await b.run('cloudPushAll(false)');
 assert.ok(docs.has('users/owner-uid/snapshots/one'));
 await b.run('cloudDeleteSnapshots(["one"])');
 assert.equal(docs.get('users/owner-uid/snapshots/one').deleted,true);
 const afterDelete=mutations; await b.run('cloudDeleteSnapshots(["one"])'); assert.equal(mutations,afterDelete,'deletion retries must not rewrite immutable tombstones');
 b.run('localStorage.removeItem(tombstoneKey());saveHistoryArray([{handle:"@safe",snapshotId:"one"}])');
 await b.run('cloudPushAll(false)');
 assert.equal(docs.get('users/owner-uid/snapshots/one').deleted,true);
 await b.run('cloudPull(false)');
 assert.equal(b.run('getSavedHistory().length'),0);
 assert.ok(paths.every(p=>p==='users/owner-uid'||p.startsWith('users/owner-uid/snapshots/')));
});
test('AI requires App Check setup before requesting the protected backend',async()=>{
 const b=boot(); let called=false;
 b.ctx.app={auth:()=>({currentUser:{uid:'owner'}}),functions:()=>({httpsCallable:()=>async()=>{called=true;return {data:{text:'unsafe'}};}})};
 b.run('WISHPLAN_FIREBASE_CONFIG={apiKey:"public",authDomain:"example.test",projectId:"test",appId:"public"};WISHPLAN_KOL_AI_ENABLED=true;fbApp=app;firebaseReady=Promise.resolve(app);currentAuditData=parseKalodataApiBundle({})');
 await b.run('runAiDeepCaseAnalysis()');
 assert.equal(called,false);
 assert.match(b.elements.get('aiAuditOutput').textContent,/App Check/i);
});
test('no client model secret or inspection blocking remains',()=>{
 assert.doesNotMatch(html, /_cipher|_salt|__invokeVaultModel|generativelanguage|contextmenu|e\.key === 'F12'/);
});
test('unconfigured Firebase and AI fail closed without using legacy sessions',async()=>{
 const b=boot(); b.storage.set('KOL_SESSION_V1',JSON.stringify({phone:'12345678'}));
 assert.equal(b.run('getSession()'),null);
 await assert.rejects(b.run('getDb()'),/configur/i);
 b.run('currentAuditData = {handle:"@test"}');
 await b.run('runAiDeepCaseAnalysis()');
 assert.match(b.elements.get('aiAuditOutput').textContent,/unavailable|not configured/i);
});
