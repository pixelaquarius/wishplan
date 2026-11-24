const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'checkkol/index.html'), 'utf8');
function boot() {
  const elements = new Map(), storage = new Map(), listeners = {};
  const element = () => ({textContent:'', value:'', style:{}, children:[], classList:{add(){},remove(){},toggle(){}}, addEventListener(){}, appendChild(child){this.children.push(child);}, setAttribute(){}});
  const document = {getElementById(id){if(!elements.has(id)) elements.set(id,element()); return elements.get(id);},querySelector(){return null;},addEventListener(){},createElement:element,head:{appendChild(){}},body:{appendChild(){}}};
  const ctx = vm.createContext({document, console, URL, setTimeout(){}, clearTimeout(){}, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{href:'https://example.test/checkkol/',origin:'https://example.test'},addEventListener:(k,v)=>listeners[k]=v,alert(){},confirm:()=>true});
  ctx.window=ctx;
  for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src=m[1].match(/src="([^"]+)"/);
    if(src && !src[1].startsWith('http')) {
      vm.runInContext(fs.readFileSync(path.join(root,'checkkol',src[1]),'utf8'),ctx);
      // Unit tests remain offline regardless of the deployed public staging config.
      // staging-config.test.cjs independently validates that real configuration.
      if(src[1] === 'firebase-config.js') ctx.WISHPLAN_FIREBASE_CONFIG = {};
    }
    else if(!src && !m[2].includes('tailwind.config')) vm.runInContext(m[2],ctx);
  }
  return {ctx,storage,elements,listeners,run:s=>vm.runInContext(s,ctx)};
}
module.exports={boot,html};
