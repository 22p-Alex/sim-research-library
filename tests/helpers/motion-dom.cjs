/* Runtime/state fixture only. No browser, screenshots or layout acceptance. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const A = require('../../web/atlas/sim-atlas-core.js');
const katex = require('../../vendor/katex/katex.min.js');
module.exports = function bootMotion(options = {}) {
  const vm = require('node:vm');
  const html = fs.readFileSync(path.join(__dirname, '../../' + (options.page || 'sim_motion_demo.html')), 'utf8');
  const nodes = [], byId = new Map(), pending = new Map(), errors = [], windowEvents = {};
  let sequence = 0, now = 0, mathRenders = 0;
  const work = { text: 0, html: 0, attributes: 0, styles: 0, measurements: 0, canvas: 0 };
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.attrs = {}; this.dataset = {}; this.children = []; this.events = {}; this.hidden = false;
      this.clientWidth = 560; this.scrollWidth = 560; this.scrollLeft = 0; this.offsetLeft = 0; this.offsetWidth = 110;
      this.style = new Proxy({ setProperty(name, value) { this[name] = value; }, getPropertyValue(name) { return String(this[name] ?? ''); } }, {
        set(target, name, value) { work.styles++; target[name] = value; return true; },
      });
      const names = new Set();
      this.classList = { toggle(name, value) { value ? names.add(name) : names.delete(name); }, remove(...values) { values.forEach(value => names.delete(value)); }, contains(name) { return names.has(name); } };
      nodes.push(this);
    }
    get textContent() { return this._textContent || ''; }
    set textContent(value) { work.text++; this._textContent = String(value); this._innerHTML = ''; }
    get innerHTML() { return this._innerHTML || ''; }
    set innerHTML(value) { work.html++; this._innerHTML = String(value); this._textContent = ''; }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { work.attributes++; this.attrs[name] = String(value); }
    removeAttribute(name) { work.attributes++; delete this.attrs[name]; }
    appendChild(node) {
      node.offsetLeft = 5 + this.children.length * 138;
      this.children.push(node); node.parent = this;
      this.scrollWidth = Math.max(this.clientWidth, node.offsetLeft + node.offsetWidth + 5);
      return node;
    }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
    scrollTo(options) { this.scrollLeft = options.left; this.lastScroll = options; }
    scrollIntoView(options) { this.lastScrollIntoView = options; }
    addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
    dispatch(name, options = {}) { (this.events[name] || []).forEach(callback => callback({ target: this, preventDefault() {}, ...options })); }
    closest(selector) {
      const tags = selector.split(',');
      for (let el = this; el; el = el.parent) if (tags.includes(el.tagName)) return el;
      return null;
    }
    getAnimations() { return []; }
    animate() { return {}; }
    focus() { doc.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch('close'); }
    getBoundingClientRect() { work.measurements++; return { left: 100, top: 100, right: 900, bottom: 800 }; }
    getContext() { return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: image => { work.canvas++; this.lastPixels = image.data; } }; }
    toDataURL() { return `data:image/png;base64,fixture${nodes.indexOf(this)}`; }
  }
  const doc = new Element('document');
  for (const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const el = new Element(match[1]); el.hidden = /\shidden(?:\s|=|\/?>)/.test(match[0]); byId.set(match[2], el);
  }
  for (const [, equation] of html.matchAll(/data-equation="([^"]+)"/g)) { const el = new Element(); el.dataset.equation = equation; }
  doc.getElementById = id => { assert.ok(byId.has(id), `renderer references a missing element: ${id}`); return byId.get(id); };
  doc.createElement = tag => new Element(tag); doc.createElementNS = (_, tag) => new Element(tag);
  doc.querySelectorAll = selector => {
    if (selector === '[data-stop]') return nodes.filter(el => el.dataset.stop !== undefined);
    if (selector === '[data-equation]') return nodes.filter(el => el.dataset.equation !== undefined);
    throw new Error('Unsupported selector: ' + selector);
  };
  doc.documentElement = new Element('html'); doc.activeElement = doc.documentElement;
  const media = { matches: false, listeners: [], addEventListener(_, callback) { this.listeners.push(callback); } };
  const context = { document: doc, SIMAtlas: A, katex: { render(tex, el, options) { mathRenders++; el.innerHTML = katex.renderToString(tex, options); }, renderToString(...args) { mathRenders++; return katex.renderToString(...args); } }, Float64Array, Uint8ClampedArray, innerWidth: 1440,
    matchMedia: () => media, getSelection: () => ({ toString: () => '' }), addEventListener(name, callback) { (windowEvents[name] ||= []).push(callback); },
    requestAnimationFrame: callback => { pending.set(++sequence, callback); return sequence; }, cancelAnimationFrame: id => pending.delete(id),
    console: { error: error => errors.push(error) },
  };
  context.window = context;
  vm.createContext(context);
  for (const [, asset] of html.matchAll(/<script src="([^"]+)"/g)) {
    const file = asset.split('?')[0];
    if (file.startsWith('vendor/')) continue;
    if (file === (options.renderer || 'web/motion/sim-motion.js')) {
      if (options.baseTimeline) {
        // Isolate the existing 24-scene choreography for its detailed tests.
        // Production composition is exercised separately, with all real scripts.
        context.SIMMotionParameterChapter.plan = model => ({
          scenes: model.scenes.map(scene => ({ ...scene, owner: 'motion' })),
          durations: model.transitionDurations, pacing: model.transitionPacing, sceneIndex: model.sceneIndex,
          index: id => model.scenes.findIndex(scene => scene.id === id),
          frame: time => ({ ...model.scenes[Math.ceil(time - 1e-9)], owner: 'motion', baseTime: time, progress: time - Math.ceil(time - 1e-9) + 1 }),
        });
      }
      options.beforeRenderer?.(context);
    }
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../..', file), 'utf8'), context, { filename: file });
  }
  const advance = () => { now += 16; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(now)); };
  const finish = () => { let i = 0; while (pending.size && i++ < 15000) advance(); assert.ok(i < 15000); };
  return { html, doc, nodes, byId, pending, errors, windowEvents, context, media, work, advance, finish, get mathRenders() { return mathRenders; }, get now() { return now; } };
};
