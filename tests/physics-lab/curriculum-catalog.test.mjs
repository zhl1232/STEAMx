import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDOM } from './dom-fixture.mjs';
import { EXPLORATIONS, TOPICS, defaults, validParams } from '../../public/physics-lab/exploration-model.mjs';
import { SCHOOL_STAGES, filterExperiments, filterCircuitLessons } from '../../public/physics-lab/curriculum-catalog.mjs';
import { createExplorations } from '../../public/physics-lab/explorations.js';

test('catalog entries have unique identifiers, valid parameters and explicit curriculum placement', () => {
  assert.equal(new Set(EXPLORATIONS.map(e => e.id)).size, EXPLORATIONS.length);
  for (const entry of EXPLORATIONS) {
    assert.ok(TOPICS.some(topic => topic.id === entry.topic), entry.id);
    assert.ok(entry.stages.length > 0, entry.id);
    assert.ok(entry.stages.every(stage => SCHOOL_STAGES.some(s => s.id === stage)), entry.id);
    if (!entry.workbench) assert.ok(validParams(entry.id, defaults(entry.id)), entry.id);
  }
  const primary = filterExperiments({ stage: 'primary' }).map(e => e.id);
  for (const id of ['sound', 'shadow', 'mixing', 'magnets', 'circuit', 'uniform-motion']) assert.ok(primary.includes(id), id);
  for (const id of ['field', 'capacitor', 'ideal-gas', 'interference']) assert.ok(!primary.includes(id), id);
  assert.ok(filterExperiments({ stage: 'high', topic: 'wave' }).some(e => e.id === 'interference'));
});

test('search finds familiar names and combines school stage, topic and every search word', () => {
  assert.deepEqual(filterExperiments({ query: '  热交换  ' }).map(e => e.id), ['mixing']);
  assert.deepEqual(filterExperiments({ stage: 'high', topic: 'motion', query: '平抛' }).map(e => e.id), ['projectile']);
  assert.deepEqual(filterExperiments({ query: '电场 库仑' }).map(e => e.id), ['field']);
  assert.deepEqual(filterExperiments({ stage: 'primary', query: '平抛' }), []);
  assert.deepEqual(filterExperiments({ topic: 'sound', query: '热交换' }), []);
  assert.deepEqual(filterExperiments({ query: '<img src=x onerror=alert(1)>' }), []);
});

test('circuit task search finds the real task and respects combined filters without inflating model counts', () => {
  assert.ok(filterCircuitLessons({ query: '分压' }).some(task => task.id === 'divider'));
  assert.ok(filterCircuitLessons({ query: '欧姆定律' }).some(task => task.id === 'ohm_u'));
  assert.ok(filterCircuitLessons({ stage: 'middle', query: '欧姆定律' }).some(task => task.id === 'ohm_r'));
  assert.deepEqual(filterCircuitLessons({ stage: 'primary', query: '分压' }), []);
  assert.deepEqual(filterCircuitLessons({ topic: 'light', query: '分压' }), []);
  assert.deepEqual(filterCircuitLessons({ query: '' }), []);
  assert.equal(filterCircuitLessons({ includeAll:true }).length,18);
  assert.equal(filterCircuitLessons({ includeAll:true,topic:'light' }).length,0);
  assert.ok(filterExperiments({ query: '大气压' }).some(entry => entry.id === 'hydrostatic'));
});

test('search-only task results open the specific circuit task', async () => {
  const env = createDOM(await readFile(new URL('../../public/physics-lab/index.html', import.meta.url), 'utf8'));
  Object.assign(globalThis, { document: env.document, localStorage: env.localStorage, requestAnimationFrame: env.requestAnimationFrame });
  const $ = selector => document.querySelector(selector);
  let task = null, workbench = null;
  const lab = createExplorations({ openModal() {}, closeModal() {}, toast() {}, openWorkbench(mode) { workbench = mode; }, openCircuitLessons(id) { task = id; } });
  lab.catalog(); $('#catalog-search').value = '分压'; await $('#catalog-search').fire('input');
  assert.match($('#catalog-result-count').textContent, /电路任务/);
  assert.equal($('.catalog-empty'), null);
  await $('[data-circuit-lesson="divider"]').fire('click');
  assert.equal(task, 'divider'); assert.equal(workbench, 'circuit');
  assert.equal($('#experiment-catalog').hidden, true);
});

test('discrete choices have readable options, reject unavailable values, and restore with observations', async () => {
  const env = createDOM(await readFile(new URL('../../public/physics-lab/index.html', import.meta.url), 'utf8'));
  Object.assign(globalThis, { document: env.document, localStorage: env.localStorage, requestAnimationFrame: env.requestAnimationFrame });
  const $ = selector => document.querySelector(selector);
  const lab = createExplorations({ openModal() {}, closeModal() {}, toast() {}, openWorkbench() {} });
  lab.start('circuit-meters');
  assert.equal($('#topic-meter').tagName, 'SELECT');
  assert.match($('#topic-meter').textContent, /电流表 A/);
  $('#topic-meter').value = '1'; await $('#topic-meter').fire('input');
  $('#topic-connection').value = '1'; await $('#topic-connection').fire('input');
  assert.match($('#topic-notice').textContent, /接线与量程正确/);
  assert.equal(validParams('circuit-meters', { ...defaults('circuit-meters'), polarity: 0 }), null);
  lab.start('circuit-meters', { params: { ...defaults('circuit-meters'), meter: 1, connection: 1, polarity: -1 }, time: 0, level: 1 });
  assert.equal($('#topic-polarity').value, '-1');
  assert.match($('#topic-notice').textContent, /红黑接反/);
});

test('the single catalog entry paginates all experiments, retain filters and recover from no results', async () => {
  const env = createDOM(await readFile(new URL('../../public/physics-lab/index.html', import.meta.url), 'utf8'));
  Object.assign(globalThis, { document: env.document, localStorage: env.localStorage, requestAnimationFrame: env.requestAnimationFrame });
  const $ = selector => document.querySelector(selector), $$ = selector => document.querySelectorAll(selector);
  const click = async target => (typeof target === 'string' ? $(target) : target).fire('click');
  let openedCircuit = 0, workbench = null;
  createExplorations({ openModal() {}, closeModal() {}, toast() {}, openWorkbench(mode) { workbench = mode; }, openCircuitLessons() { openedCircuit++; } });
  await click('#topics-btn');
  assert.equal($('#experiment-catalog').hidden, false);
  assert.equal($$('[data-topic]').length, TOPICS.length + 1);
  const visited = [], visitedTasks = [];
  do {
    const entries = $$('[data-exploration]').map(e => e.dataset.exploration);
    assert.ok(entries.length + $$('[data-circuit-lesson]').length <= 12);
    visited.push(...entries);
    visitedTasks.push(...$$('[data-circuit-lesson]').map(e=>e.dataset.circuitLesson));
    if ($('#catalog-next').disabled) break;
    await click('#catalog-next');
  } while (true);
  assert.equal(visited.length, EXPLORATIONS.length);
  assert.equal(visitedTasks.length,18);
  assert.equal(new Set(visitedTasks).size,18);
  assert.deepEqual(new Set(visited), new Set(EXPLORATIONS.map(e => e.id)));
  await click($$('[data-school-stage]').find(e => e.dataset.schoolStage === 'primary'));
  assert.equal($('#catalog-prev').disabled, true);
  $('#catalog-search').value = '热交换'; await $('#catalog-search').fire('input');
  assert.deepEqual($$('[data-exploration]').map(e => e.dataset.exploration), ['mixing']);
  await click('[data-exploration="mixing"]'); await click('#topics-btn');
  assert.equal($('#catalog-search').value, '热交换');
  assert.equal($$('[data-school-stage]').find(e => e.dataset.schoolStage === 'primary').getAttribute('aria-pressed'), 'true');
  $('#catalog-search').value = '<img src=x>'; await $('#catalog-search').fire('input');
  assert.equal($$('[data-exploration]').length, 0); assert.equal($$('img').length, 0);
  assert.match($('#catalog-result-count').textContent, /没有找到/);
  await click('#catalog-clear');
  assert.equal($('#catalog-search').value, ''); assert.equal($('#catalog-clear').disabled, true);
  await click('[data-topic="electric"]');
  assert.equal(openedCircuit, 0); assert.equal(workbench, null);
  assert.equal($('#experiment-catalog').hidden, false);
  assert.equal($('[data-topic="electric"]').getAttribute('aria-pressed'), 'true');
});

test('opening the catalog pauses the visible experiment without losing its parameters or time', async () => {
  const env = createDOM(await readFile(new URL('../../public/physics-lab/index.html', import.meta.url), 'utf8'));
  Object.assign(globalThis, { document: env.document, localStorage: env.localStorage, requestAnimationFrame: env.requestAnimationFrame });
  const $ = selector => document.querySelector(selector);
  const lab = createExplorations({ openModal() {}, closeModal() {}, toast() {}, openWorkbench() {} });
  lab.start('pendulum');
  $('#topic-length').value = '2'; await $('#topic-length').fire('input');
  await $('#topic-play').fire('click'); env.tick(100); env.tick(150);
  const time = $('#topic-time').value;
  assert.ok(Number(time) > 0);
  await $('#topics-btn').fire('click'); env.tick(200);
  lab.applyRoute({experiment:'pendulum',stage:'all',topic:'all',query:'',page:1});
  assert.equal($('#topic-time').value, time); assert.equal($('#topic-length').value, '2');
  assert.equal($('#topic-play').textContent, '播放过程');
  assert.equal($('body').classList.contains('topic-active'), true);
  lab.start('hydrostatic');
  assert.match($('#topic-atmosphere-value').textContent, /101\.325/);
});


test('catalog routes provide real links, retain filters, and apply without a navigation loop', async () => {
  const env = createDOM(await readFile(new URL('../../public/physics-lab/index.html', import.meta.url), 'utf8'));
  Object.assign(globalThis, { document: env.document, localStorage: env.localStorage, requestAnimationFrame: env.requestAnimationFrame });
  const $ = selector => document.querySelector(selector);
  const navigations = [];
  const lab = createExplorations({ openModal() {}, closeModal() {}, toast() {}, openWorkbench() {},
    routeHref: route => '/lab?' + new URLSearchParams(Object.entries(route).filter(([, value]) => value !== null)),
    onNavigate(route, options) { navigations.push({route, options}); lab.applyRoute(route); },
  });
  const initial = {experiment:null,lesson:null,stage:'all',topic:'electric',query:'分压',page:1};
  lab.applyRoute(initial);
  assert.equal(navigations.length, 0);
  assert.equal($('#catalog-close'), null);
  const task = $('[data-circuit-lesson="divider"]');
  assert.equal(task.tagName, 'A');
  assert.match(task.getAttribute('href'), /lesson=divider/);
  const modified = await task.fire('click', {ctrlKey:true});
  assert.equal(modified.defaultPrevented, undefined);
  assert.equal(navigations.length, 0);
  await task.fire('click');
  assert.deepEqual(navigations.at(-1).route, {...initial,experiment:'circuit',lesson:'divider'});
  await $('#topics-btn').fire('click');
  assert.deepEqual(navigations.at(-1).route, initial);
  $('#catalog-search').value='欧姆'; await $('#catalog-search').fire('input');
  assert.equal(navigations.at(-1).options.replace, true);
  assert.equal(navigations.at(-1).route.query, '欧姆');
});

test('returning through routes restores each parameter experiment separately', async () => {
  const env = createDOM(await readFile(new URL('../../public/physics-lab/index.html', import.meta.url), 'utf8'));
  Object.assign(globalThis, { document: env.document, localStorage: env.localStorage, requestAnimationFrame: env.requestAnimationFrame });
  const $ = selector => document.querySelector(selector);
  const lab = createExplorations({ openModal() {}, closeModal() {}, toast() {}, openWorkbench() {} });
  const route = experiment => ({experiment,lesson:null,stage:'high',topic:'all',query:'',page:2});
  lab.applyRoute(route('pendulum'));
  $('#topic-length').value='2'; await $('#topic-length').fire('input');
  $('#topic-level').value='2'; await $('#topic-level').fire('change');
  $('#topic-time').value='1'; await $('#topic-time').fire('input');
  lab.applyRoute(route('hydrostatic'));
  lab.applyRoute(route(null));
  lab.applyRoute(route('pendulum'));
  assert.equal($('#topic-length').value,'2');
  assert.equal($('#topic-time').value,'1');
  assert.equal($('#topic-level').value,'2');
  assert.equal($('#back-workbench'),null);
  assert.equal($('#topics-btn').tagName,'A');
  assert.match($('#topics-btn').textContent,/实验目录/);
  assert.equal(document.querySelectorAll('a').filter(link=>link.textContent.includes('实验目录')).length,1);
});


test('long catalog searches remain within the route limit and allow subsequent navigation', async () => {
  const env = createDOM(await readFile(new URL('../../public/physics-lab/index.html', import.meta.url), 'utf8'));
  Object.assign(globalThis, { document: env.document, localStorage: env.localStorage, requestAnimationFrame: env.requestAnimationFrame });
  const $ = selector => document.querySelector(selector), navigations = [];
  const lab = createExplorations({ openModal() {}, closeModal() {}, toast() {}, openWorkbench() {},
    onNavigate(route, options) { assert.ok(route.query.length <= 120); navigations.push({route, options}); lab.applyRoute(route); },
  });
  lab.applyRoute({experiment:null,lesson:null,stage:'all',topic:'all',query:'',page:1});
  assert.equal($('#catalog-search').getAttribute('maxlength'), '120');
  $('#catalog-search').value='长'.repeat(150); await $('#catalog-search').fire('input');
  assert.equal($('#catalog-search').value, '长'.repeat(120));
  assert.equal(navigations.at(-1).route.query.length, 120);
  assert.equal(navigations.at(-1).options.replace, true);
  await $('[data-topic="electric"]').fire('click');
  assert.equal(navigations.at(-1).route.topic, 'electric');
  await $('#catalog-clear').fire('click');
  assert.equal(navigations.at(-1).route.query, '');
  await $('[data-exploration]').fire('click');
  assert.ok(navigations.at(-1).route.experiment);
});
