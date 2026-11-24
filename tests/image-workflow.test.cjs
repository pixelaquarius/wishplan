const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../ghepanh/index.html'), 'utf8');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
function harness() {
  const nodes = new Map(), draws = [], links = [];
  function element(id = '') {
    return { id, style: {}, children: [], events: {}, dataset: {}, value: ({'gap-range':'0','bg-color':'#ffffff','format-select':'image/jpeg','quality-range':'90','columns-select':'auto','size-select':'original'})[id] || '',
      classList:{add(){},remove(){}}, addEventListener(k,fn){this.events[k]=fn;},
      removeAttribute(k){delete this[k];}, setAttribute(k,v){this[k]=v;},
      replaceChildren(...children){this.children=children;}, appendChild(n){this.children.push(n);},
      click(){this.clicked=true; this.events.click?.({});}, focus(){if(!this.disabled)this.focused=true;},
      querySelectorAll(){return this.children.flatMap(n=>[n,...n.querySelectorAll()]).filter(n=>n.type==='button');},
      getContext:()=>({fillRect(){},drawImage(...args){draws.push(args);}}),
      toDataURL(type='image/png'){return `data:${type};base64,ok`;}
    };
  }
  const node = id => {if(!nodes.has(id)) nodes.set(id,element(id));return nodes.get(id);};
  class Image { set src(v){if(!v)return;this._src=v;this.width=this.naturalWidth=1200;this.height=this.naturalHeight=800;this.onload?.();} get src(){return this._src;} }
  let url=0;
  const context=vm.createContext({document:{getElementById:node,querySelectorAll:()=>[],createElement(tag){const e=element();if(tag==='a')links.push(e);return e;}},Image,URL:{createObjectURL:()=>`blob:${++url}`,revokeObjectURL(){}},setTimeout,clearTimeout,console});
  const run=code=>vm.runInContext(code,context);
  run(source);
  return {nodes,draws,links,run,context, async load(n=3){context.files=Array.from({length:n},(_,i)=>({type:'image/png',size:10,name:`photo-${i}.png`}));await run('handleFiles(files)');}};
}

for (const count of [0, 37]) {
  test(`invalid replacement of ${count} images cannot export a previous successful batch`, async () => {
    const h = harness(); await h.load(2);
    assert.equal(h.nodes.get('download-btn').disabled, false);
    h.nodes.get('export-status').textContent = 'Previous export';
    await h.load(count);
    assert.equal(h.nodes.get('download-btn').disabled, true);
    assert.equal(h.nodes.get('preview-img').src, undefined);
    assert.equal(h.nodes.get('controls-panel').style.display, 'none');
    assert.equal(h.nodes.get('grid-stats').textContent, '0 ảnh');
    assert.equal(h.nodes.get('export-status').textContent, '');
    assert.equal(h.run('loadedImages.length'), 0);
    assert.match(h.nodes.get('drop-title').textContent, /1 đến 36/);
  });
}

test('moving to the boundary keeps keyboard focus on an enabled action',async()=>{
  const h=harness(); await h.load(2);
  h.nodes.get('image-list').children[1].children[2].children[0].click();
  const actions=h.nodes.get('image-list').children[0].children[2].children;
  assert.ok(actions.some(button=>button.focused && !button.disabled));
});

test('reset clears stale export feedback and invalid ordering actions do not mutate images', async()=>{
  const h=harness(); await h.load(2);
  assert.equal(h.run('moveImage(0,-1)'),false);
  assert.equal(h.run('moveImage(99,1)'),false);
  assert.equal(h.run('removeImage(-1)'),false);
  const before=h.run('loadedImages[0]');
  assert.equal(h.run('moveImage(0,2)'),false);
  assert.equal(h.run('loadedImages[0]'),before);
  assert.match(h.nodes.get('image-list').children[0].children[0].src,/^data:image\/jpeg/);
  h.nodes.get('download-btn').click();
  assert.ok(h.nodes.get('export-status').textContent);
  h.nodes.get('reset-btn').click();
  assert.equal(h.nodes.get('export-status').textContent,'');
  assert.equal(h.nodes.get('grid-stats').textContent,'0 ảnh');
  assert.equal(h.nodes.get('controls-panel').style.display,'none');
  assert.equal(h.nodes.get('image-list').children.length,0);
});

test('page presents the three-step local workflow and visible limits before file selection',()=>{
  assert.match(html, /class="wp-tool-header"/);
  assert.match(html, /href="\.\.\/assets\/wishplan.css"/);
  assert.match(html, /1\. Chọn ảnh/); assert.match(html,/2\. Sắp xếp/); assert.match(html,/3\. Tải ảnh/);
  assert.ok(html.indexOf('72 MP') < html.indexOf('id="file-input"'));
  assert.match(html, /<details[\s\S]*id="bg-color"[\s\S]*id="format-select"[\s\S]*<\/details>/);
  assert.match(html, /<ol id="image-list"/);
  assert.doesNotMatch(html,/Playfair|Image Studio/);
});

test('column and output-size choices redraw without cropping or exceeding safety budgets', async()=>{
  const h=harness(); await h.load(4);
  h.nodes.get('columns-select').value='2';
  h.nodes.get('size-select').value='2048';
  h.nodes.get('columns-select').events.change();
  assert.equal(h.nodes.get('canvas').width,2048);
  assert.equal(h.nodes.get('canvas').height,2048);
  h.nodes.get('columns-select').value='1';
  h.nodes.get('size-select').events.change();
  assert.equal(h.nodes.get('canvas').width,512);
  assert.equal(h.nodes.get('canvas').height,2048);
  const [,x,y,w,height]=h.draws.at(-1);
  assert.ok(x>=0 && y>=0); assert.equal(w/height,1.5);
  h.nodes.get('columns-select').value='auto';
  h.nodes.get('columns-select').events.change();
  assert.equal(h.nodes.get('canvas').width,h.nodes.get('canvas').height);
  h.nodes.get('columns-select').value='999';
  h.nodes.get('columns-select').events.change();
  assert.equal(h.nodes.get('canvas').width,h.nodes.get('canvas').height);
  h.run('loadedImages = Array.from({length:36},()=>({width:5000,height:4800}))');
  h.nodes.get('size-select').value='original';
  h.nodes.get('size-select').events.change();
  const c=h.nodes.get('canvas');
  assert.ok(c.width*c.height<=16000000 && c.width<=8192 && c.height<=8192);
});

test('exports use the actual MIME extension with explicit fallback and PNG ignores quality', async()=>{
  const h=harness(); await h.load(1);
  const canvas=h.nodes.get('canvas');
  for(const [mime,ext] of [['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]) {
    h.nodes.get('format-select').value=mime;
    h.nodes.get('format-select').events.change();
    assert.equal(h.nodes.get('quality-range').disabled,mime==='image/png');
    let args;
    canvas.toDataURL=(...a)=>{args=a;return `data:${mime};base64,ok`;};
    h.nodes.get('download-btn').click();
    assert.match(h.links.at(-1).download,new RegExp(`\\.${ext}$`));
    assert.equal(args[0],mime);
    assert.equal(args[1],mime==='image/png'?undefined:0.9);
  }
  h.nodes.get('format-select').value='image/webp';
  canvas.toDataURL=()=> 'data:image/png;base64,ok';
  h.nodes.get('download-btn').click();
  assert.match(h.links.at(-1).download,/\.png$/);
  assert.match(h.nodes.get('export-status').textContent,/không hỗ trợ.*PNG/i);
  canvas.toDataURL=()=> 'data:,';
  const before=h.links.filter(l=>l.clicked).length;
  h.nodes.get('download-btn').click();
  assert.equal(h.links.filter(l=>l.clicked).length,before);
  assert.match(h.nodes.get('export-status').textContent,/Không xuất/);
});

test('thumbnail buttons reorder actual canvas images and remove to an empty safe state', async()=>{
  const h=harness(); await h.load();
  const originals=h.run('loadedImages.slice()');
  let cards=h.nodes.get('image-list').children;
  assert.equal(cards.length,3);
  assert.equal(cards[0].children[2].children[0].disabled,true);
  cards[0].children[2].children[1].click();
  assert.equal(h.run('loadedImages[1]'),originals[0]);
  assert.equal(h.draws.at(-3)[0],originals[1]);
  cards=h.nodes.get('image-list').children;
  cards[1].children[2].children[0].click();
  assert.equal(h.run('loadedImages[0]'),originals[0]);
  cards=h.nodes.get('image-list').children;
  cards[1].children[2].children[2].click();
  assert.equal(h.run('loadedImages.length'),2);
  assert.equal(h.run('loadedImages[1]'),originals[2]);
  h.run('removeImage(1); removeImage(0)');
  assert.equal(h.nodes.get('image-list').children.length,0);
  assert.equal(h.nodes.get('download-btn').disabled,true);
  assert.equal(h.nodes.get('preview-img').src,undefined);
  assert.equal(h.nodes.get('canvas').width,1);
});
