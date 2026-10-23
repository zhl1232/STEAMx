// A DOM-only fixture for event/state integration tests. It does not render,
// perform layout, or substitute for a desktop browser acceptance test.
const voidTags=new Set(['meta','link','input','img','br','hr']);
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|#39);/g,c=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[c]));
class Element {
  constructor(tag,attributes={}){this.tagName=tag.toUpperCase();this.attributes=attributes;this.children=[];this.parent=null;this.listeners={};this.style={};this._text='';this._value=attributes.value;this.disabled=false;this.open=false;this.captures=new Set();}
  get dataset(){return Object.fromEntries(Object.entries(this.attributes).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));}
  get classList(){const e=this;return {contains:c=>(e.attributes.class||'').split(' ').includes(c),add:(...cs)=>{e.attributes.class=[...new Set((e.attributes.class||'').split(' ').filter(Boolean).concat(cs))].join(' ');},remove:c=>{e.attributes.class=(e.attributes.class||'').split(' ').filter(x=>x!==c).join(' ');},toggle:(c,b)=>{const present=(e.attributes.class||'').split(' ').includes(c);const on=b??!present;if(on)e.classList.add(c);else e.classList.remove(c);return on;}};}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k];}
  get value(){return this._value??this.attributes.value??'';}
  set value(v){this._value=String(v);}
  get step(){return this.attributes.step||'';}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set textContent(v){this._text=String(v);this.children=[];}
  get innerHTML(){return this._text+this.children.map(c=>c.serialize()).join('');}
  set innerHTML(html){this._text='';this.children=[];parse(String(html),this);}
  serialize(){return `<${this.tagName.toLowerCase()} ${Object.entries(this.attributes).map(([k,v])=>`${k}="${v}"`).join(' ')}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;}
  matches(selector){if(selector.startsWith('#'))return this.attributes.id===selector.slice(1);if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));const attr=selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);if(attr)return this.attributes[attr[1]]!==undefined&&(attr[2]===undefined||this.attributes[attr[1]]===attr[2]);return this.tagName===selector.toUpperCase();}
  querySelectorAll(selector){const out=[];const walk=e=>{for(const c of e.children){if(c.matches(selector))out.push(c);walk(c);}};walk(this);return out;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  closest(s){for(let e=this;e;e=e.parent)if(e.matches(s))return e;return null;}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
  async fire(type,properties={}){const event={type,target:this,button:0,clientX:0,clientY:0,pointerId:1,preventDefault(){this.defaultPrevented=true;},...properties};for(let e=this;e;e=e.parent){if(typeof e['on'+type]==='function')await e['on'+type](event);for(const handler of e.listeners[type]||[])await handler(event);}return event;}
  click(){return this.fire('click');}
  showModal(){this.open=true;}
  close(){this.open=false;}
  getBoundingClientRect(){return {x:0,y:0,left:0,top:0,right:1000,bottom:600,width:1000,height:600};}
  setPointerCapture(id){this.captures.add(id);}
  releasePointerCapture(id){this.captures.delete(id);}
  hasPointerCapture(id){return this.captures.has(id);}
}
function parse(html,root){let current=root;for(const token of html.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g)||[]){if(token.startsWith('<!'))continue;if(token.startsWith('</')){const tag=token.slice(2,-1).trim().toUpperCase();let p=current;while(p!==root&&p.tagName!==tag)p=p.parent;if(p!==root)current=p.parent;continue;}if(token.startsWith('<')){const m=token.match(/^<([\w-]+)/);if(!m)continue;const attr={};const source=token.slice(m[0].length).replace(/\/?\s*>$/,'');for(const a of source.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attr[a[1]]=decode(a[2]??a[3]??a[4]??'');const child=new Element(m[1],attr);child.parent=current;current.children.push(child);if(!voidTags.has(m[1])&&!token.endsWith('/>'))current=child;}else{const text=new Element('#text');text._text=decode(token);text.parent=current;current.children.push(text);}}}
export function createDOM(html){const document=new Element('document');parse(html,document);document.visibilityState='visible';document.createElement=tag=>new Element(tag);const saved=new Map();const localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)};let frame=null;const raf=f=>frame=f;const tick=now=>{const f=frame;frame=null;if(f)f(now);};return {document,localStorage,requestAnimationFrame:raf,tick};}
