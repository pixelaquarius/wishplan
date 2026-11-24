const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const script = p => [...read(p).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

function functionCode(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const indent = source.slice(source.lastIndexOf('\n', start) + 1, start).replace('async ', '');
  const close = '\n' + indent + '}';
  const end = source.indexOf(close, start);
  assert.ok(end >= 0, `Missing end of ${name}`);
  return source.slice(start, end + close.length);
}

test('temple solo mode opens no cross-user transports and sends no state', () => {
  const source = script('tetlasy/index.html');
  const calls = [];
  const counter = {};
  const context = vm.createContext({
    onlineCounter: counter, npcInstances: [{}, {}], remotePlayers: new Map(),
    myStatePayload: () => { calls.push('payload'); return {}; },
    mqttClient: { connected: true, publish: () => calls.push('publish') },
    bcChannel: { postMessage: () => calls.push('broadcast') },
    mqtt: { connect: () => { calls.push('connect'); throw Error('public network'); } },
    BroadcastChannel: function () { calls.push('channel'); throw Error('cross tab'); },
    setInterval: () => calls.push('timer'), myId: 'local', seenEventIds: new Set(), MQTT_TOPIC: 'test'
  });
  for (const name of ['publishEvent', 'publishMyStateNow', 'initMultiplayer']) {
    vm.runInContext(functionCode(source, name), context);
  }
  vm.runInContext('initMultiplayer(); publishMyStateNow(); publishEvent({type:"incense"})', context);
  assert.deepEqual(calls, []);
  assert.match(counter.textContent, /Chế độ solo/);
  assert.ok(!read('tetlasy/index.html').includes('mqtt.min.js'));
});

test('temple player and activity payloads are rendered as text', () => {
  const source = script('tetlasy/index.html');
  const attack = '<img src=x onerror=alert(1)>';
  const leaderboard = {}, activity = {};
  const context = vm.createContext({ player: { name: attack }, meritPoints: 1, leavesSwept: 0,
    sutraSeconds: 0, remotePlayers: new Map(), npcInstances: [],
    meritActivityLog: [{t: attack, who: attack, action: attack, pts: attack}],
    rankingLeaderboardView: leaderboard, rankingActivityView: activity });
  if (source.includes('function escapeHtml(')) vm.runInContext(functionCode(source, 'escapeHtml'), context);
  vm.runInContext(functionCode(source, 'renderRankingModal') + '; renderRankingModal()', context);
  for (const node of [leaderboard, activity]) {
    assert.ok(!node.innerHTML.includes('<img'), 'Untrusted markup must not reach innerHTML');
    assert.ok(node.innerHTML.includes('&lt;img'));
  }
});

test('Grab chat uses text nodes and tolerates malformed saved chat', () => {
  const source = read('grab/app.js');
  const target = { children: [], replaceChildren() { this.children = []; }, appendChild(n) { this.children.push(n); } };
  const context = vm.createContext({ document: { createElement: () => ({}) } });
  vm.runInContext(functionCode(source, 'renderChatMessages'), context);
  context.target = target;
  context.logs = [['me', '<svg onload=alert(1)>'], null, {}, ['drv', 'OK'], ['me', {}]];
  vm.runInContext('renderChatMessages(target, logs)', context);
  assert.equal(target.children.length, 2);
  assert.equal(target.children[0].textContent, '<svg onload=alert(1)>');
  assert.equal(target.children[0].className, 'me');
  assert.equal(target.children[1].textContent, 'OK');
  for (const n of target.children) assert.equal(n.innerHTML, undefined);
  vm.runInContext('renderChatMessages(target, null)', context);
  assert.equal(target.children.length, 0);
  assert.ok(source.includes('renderChatMessages($(\'#ms\'), o.chatLogs)'));
});

test('temple local JSON rejects invalid roots and malformed persisted fields', () => {
  const source = script('tetlasy/index.html');
  for (const raw of ['null', '[]', '"name"', '{broken', JSON.stringify({name: {}, color: 'red', x: 'Infinity', meritPoints: 'bad', fortuneHistory: [null, {}], meritActivityLog: [null, {}]})]) {
    const context = vm.createContext({ STATE_KEY: 'same-key', localStorage: {getItem: () => raw} });
    vm.runInContext(functionCode(source, 'loadLocalState') + '; result = loadLocalState()', context);
    assert.ok(context.result && !Array.isArray(context.result) && typeof context.result === 'object');
    assert.ok(context.result.name === undefined || typeof context.result.name === 'string');
    assert.ok(context.result.meritPoints === undefined || Number.isFinite(context.result.meritPoints));
    assert.ok(!context.result.fortuneHistory || context.result.fortuneHistory.length === 0);
    assert.ok(!context.result.meritActivityLog || context.result.meritActivityLog.length === 0);
  }
  const valid = { name: 'Bình', x: 4, meritPoints: 8, fortuneHistory: [{number: 1, title: 'An', level: 'Tốt', date: 'x', time: 'y'}], meritActivityLog: [{t:'10:00',who:'Bình',action:'Quét lá',pts:1}] };
  const context = vm.createContext({ STATE_KEY: 'same-key', localStorage: { getItem: k => k === 'same-key' ? JSON.stringify(valid) : null } });
  vm.runInContext(functionCode(source, 'loadLocalState') + '; result = loadLocalState()', context);
  assert.equal(context.result.name, 'Bình');
  assert.equal(context.result.meritPoints, 8);
  assert.equal(context.result.fortuneHistory.length, 1);
  assert.equal(context.result.meritActivityLog.length, 1);
});

function imageHarness(ImageClass) {
  const nodes = new Map();
  const draws = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {style:{}, value: id === 'gap-range' ? '2' : '#fff', classList:{add(){},remove(){}}, events:{},
      addEventListener(k, fn) {this.events[k] = fn;}, removeAttribute(k) {delete this[k];}, click(){},
      getContext: () => ({fillRect(){}, drawImage(...args){draws.push(args);}}), toDataURL: () => 'data:image/jpeg;base64,test'});
    return nodes.get(id);
  };
  const revoked = [];
  const context = vm.createContext({ document: {getElementById: node,querySelectorAll:()=>[],createElement:()=>node('link')},
    FileReader: class { readAsDataURL() { this.onload({target:{result:'data:test'}}); } },
    Image: ImageClass, URL: {createObjectURL:()=> 'blob:test',revokeObjectURL: u => revoked.push(u)}, setTimeout,clearTimeout, console });
  vm.runInContext(script('ghepanh/index.html'), context);
  return {context, nodes, revoked, draws, run: code => vm.runInContext(code, context)};
}

test('image decoder rejects corrupt, oversized and unreadable images and cleans URLs', async () => {
  for (const mode of ['corrupt','pixels','empty','oversize-file']) {
    class FakeImage {
      set src(value) {
        if (!value) return;
        if (mode === 'corrupt') this.onerror?.();
        else {this.width = this.naturalWidth = mode === 'pixels' ? 10000 : mode === 'empty' ? 0 : 100; this.height = this.naturalHeight = 10000; this.onload();}
      }
    }
    const h = imageHarness(FakeImage);
    h.context.file = {type:'image/jpeg', size:mode === 'oversize-file' ? 50 * 1024 * 1024 : 10};
    await assert.rejects(Promise.race([h.run('loadImage(file)'), new Promise((_, reject) => setTimeout(() => reject(Error('decoder did not settle')), 100))]), /ảnh|Ảnh|tệp|Tệp/);
    if (mode !== 'oversize-file') assert.equal(h.revoked.length, 1);
  }
});

test('image batch count, decoded budget and canvas budget are bounded', async () => {
  let decodes = 0;
  class FakeImage { set src(v) { if (!v) return; decodes++; this.width=this.naturalWidth=4000; this.height=this.naturalHeight=4000; this.onload(); } }
  const h = imageHarness(FakeImage);
  h.context.files = Array.from({length:37},()=>({type:'image/jpeg',size:10}));
  await h.run('handleFiles(files)');
  assert.equal(decodes, 0, 'Reject excessive count before decoding');
  assert.match(h.nodes.get('drop-title').textContent, /36/);
  h.context.files = h.context.files.slice(0,5);
  await h.run('handleFiles(files)');
  assert.equal(h.run('loadedImages.length'), 0, 'Reject batch above 72MP atomically');
  assert.match(h.nodes.get('drop-title').textContent, /72/);
  h.context.files = h.context.files.slice(0,4);
  await h.run('handleFiles(files)');
  assert.equal(h.run('loadedImages.length'), 4);
  const canvas = h.nodes.get('canvas');
  assert.ok(canvas.width * canvas.height <= 16000000);
  assert.ok(canvas.width <= 8192 && canvas.height <= 8192);
  assert.equal(h.nodes.get('controls-panel').style.display, 'block');
});

test('reset and newer image selections cannot be overwritten by stale decodes', async () => {
  const pending = [];
  class DeferredImage { set src(v) { if (v) pending.push(this); } }
  const h = imageHarness(DeferredImage);
  h.context.files = [{type:'image/png',size:10}];
  const old = h.run('handleFiles(files)');
  h.nodes.get('reset-btn').events.click();
  Object.assign(pending[0], {width:100,height:100,naturalWidth:100,naturalHeight:100}); pending[0].onload();
  await old;
  assert.equal(h.run('loadedImages.length'), 0);
  const first = h.run('handleFiles(files)');
  const second = h.run('handleFiles(files)');
  Object.assign(pending[2], {width:200,height:200,naturalWidth:200,naturalHeight:200}); pending[2].onload(); await second;
  Object.assign(pending[1], {width:100,height:100,naturalWidth:100,naturalHeight:100}); pending[1].onload(); await first;
  assert.equal(h.run('loadedImages[0].width'), 200);
});

test('canvas preview and download failures leave actionable UI, not uncaught errors', async () => {
  class FakeImage { set src(v) { if (!v) return; this.width=this.naturalWidth=100; this.height=this.naturalHeight=100; this.onload(); } }
  const h = imageHarness(FakeImage);
  await h.run('handleFiles([{type:"image/png",size:10}])');
  h.nodes.get('canvas').toDataURL = () => {throw Error('allocation failure');};
  assert.doesNotThrow(() => h.run('processImages()'));
  assert.match(h.nodes.get('drop-title').textContent, /Không|Lỗi/);
  assert.equal(h.nodes.get('download-btn').disabled, true);
  assert.doesNotThrow(() => h.nodes.get('download-btn').events.click());
});

test('saved fortune history cannot inject markup', () => {
  const source = script('tetlasy/index.html');
  const box = {querySelectorAll:()=>[]};
  const context = vm.createContext({document:{getElementById:()=>box}, fortuneHistory:[{number:1,title:'<img src=x>',level:'<svg>',date:'<b>',time:'<i>'}]});
  vm.runInContext(functionCode(source,'escapeHtml') + functionCode(source,'renderFortuneHistory') + ';renderFortuneHistory()',context);
  assert.ok(!box.innerHTML.includes('<img'));
  assert.ok(box.innerHTML.includes('&lt;img'));
  assert.ok(!box.innerHTML.includes('<svg'));
});

test('tiny images remain fit-in and empty canvas exports are rejected', async () => {
  class TinyImage { set src(v) {if (v) {this.width=this.naturalWidth=1;this.height=this.naturalHeight=1;this.onload();}} }
  const h = imageHarness(TinyImage);
  await h.run('handleFiles([{type:"image/png",size:10}])');
  const [image,x,y,width,height] = h.draws[0];
  assert.ok(x >= 0 && y >= 0 && width <= 1 && height <= 1);
  h.nodes.get('canvas').toDataURL = () => 'data:,';
  assert.equal(h.run('processImages()'), false);
  assert.equal(h.nodes.get('download-btn').disabled,true);
});

test('WishPlan branding, repository links and categorized inventory preserve routes', () => {
  for (const p of ['index.html', 'README.md', 'ghepanh/index.html']) {
    const text = read(p);
    assert.doesNotMatch(text, /LASY_|miasteam/);
    // L.ASY remains the KOL campaign context, not the site/product brand.
    if (p !== 'README.md') assert.doesNotMatch(text, /L\.ASY/);
    else {
      assert.match(text, /^# WishPlan\s*$/m);
      assert.doesNotMatch(text, /^#+\s+L\.ASY(?:\s|$)/m);
    }
    assert.match(text, /WishPlan/);
  }
  const home = read('index.html');
  // Inventory is a set of named destinations, not a CSS class or attribute order.
  const cards = [...home.matchAll(/<a\b[^>]*>/g)].map(([tag]) =>
    Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))
  ).filter(attrs => attrs.id?.startsWith('card-'));
  assert.equal(cards.length, 4);
  assert.deepEqual(Object.fromEntries(cards.map(attrs => [attrs.id, new URL(attrs.href, 'https://wishplan.test/').pathname.replace(/index\.html$/, '')])), {
    'card-ghepanh': '/ghepanh/',
    'card-checkkol': '/checkkol/',
    'card-tetlasy': '/tetlasy/',
    'card-grab': '/grab/'
  });
  assert.match(home, /2 công cụ làm việc/);
  assert.match(home, /<details\b[^>]*\bid="lab"/);
  assert.ok(home.includes('aria-hidden="true">W</div>'));
  assert.match(read('README.md'), /Chế độ solo/);
  assert.match(read('README.md'), /72/);
  assert.match(read('README.md'), /node --test/);
  assert.ok(read('README.md').replace(/\r/g, '').includes('|\n| **Grab (giả lập)**'), 'Grab remains in the same Markdown table');
  for (const route of ['tetlasy', 'ghepanh', 'checkkol', 'grab']) {
    assert.ok(cards.some(attrs => new URL(attrs.href, 'https://wishplan.test/').pathname.replace(/index\.html$/, '') === `/${route}/`));
    assert.ok([...read('README.md').matchAll(/\]\(([^)]+)\)/g)].some(([, href]) => new URL(href, 'https://wishplan.test/').pathname.replace(/index\.html$/, '') === `/${route}/`));
  }
  assert.match(home, /github\.com\/pixelaquarius\/wishplan/);
  assert.match(read('tetlasy/index.html'), /Tết WishPlan/);
});
