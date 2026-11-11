import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build, importantize } from '../tools/build.mjs';

test('importantize promotes declarations but never keyframes', () => {
  const css = importantize(`
    /* note; with { braces } */
    .a { color: red; --x: url("a;b{c}") }
    .b { @media (min-width: 600px) { width: calc(1px + 2px); & .c:hover { top: 0 !important } } }
    @keyframes k { to { opacity: 0 } }
  `);
  assert.match(css, /\.a\{color: red !important;--x: url\("a;b\{c\}"\) !important;\}/);
  assert.match(css, /@media \(min-width: 600px\)\{width: calc\(1px \+ 2px\) !important;/);
  assert.match(css, /& \.c:hover\{top: 0 !important;\}/);
  assert.match(css, /@keyframes k\{to\{opacity: 0;\}/);
  assert.throws(() => importantize('.a { color: red'));
});

test('package holds every entrypoint and stays inside host rules', async () => {
  const { files } = await build();
  const names = files.map((file) => file.name);
  const manifest = JSON.parse(files[0].bytes.toString());
  const { styles, scenes, script } = manifest.entrypoints;
  for (const entry of [...styles, ...scenes, script, 'LICENSE']) assert.ok(names.includes(entry), entry);
  assert.match(manifest.id, /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/);
  assert.equal(manifest.apiVersion, 4);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.ok(!/(^|\/)\.|\.\.|^\/|:/.test(name) && name.split('/').length <= 8, name);
  for (const file of files.filter((item) => item.name.endsWith('.css'))) {
    const css = file.bytes.toString();
    assert.ok(!/@import|url\(/.test(css), `${file.name}: no external resources`);
  }
  assert.ok(!/fetch\(|eval\(|invoke\(|location\.|import\(|new Function|XMLHttpRequest/.test(
    files.find((file) => file.name === script).bytes.toString(),
  ));
});

test('script registers the page, renders within block limits and seeks from the lyric index', async () => {
  const calls = [];
  const handlers = {};
  const record = (name) => (...args) => (calls.push([name, ...args]), Promise.resolve({ ok: true }));
  const timedLines = Array.from({ length: 120 }, (_, index) => ({
    id: `x${index}`,
    text: index % 10 === 9 ? '' : `Line ${index}`,
    startMs: index * 1000,
  }));
  const ctx = {
    log: { warn: record('warn') },
    track: { get: async () => ({ title: 'Quiet Light', artists: ['Mira Vale'], album: 'Sun Room', durationMs: 252000 }) },
    player: {
      get: async () => ({ isPlaying: true, positionMs: 61000, durationMs: 252000 }),
      seek: record('seek'),
      toggle: record('toggle'),
      next: record('next'),
      previous: record('previous'),
    },
    lyrics: { get: async () => ({ lines: [], timedLines, currentLine: 61 }) },
    settings: { get: async () => ({ homeArrangement: 'Stations first' }) },
    layout: { set: record('layout.set'), clear: record('layout.clear') },
    navigation: { register: record('navigation.register') },
    pages: {
      register: record('pages.register'),
      render: record('pages.render'),
      onMount: (_id, handler) => ((handlers.mount = handler), () => {}),
      onUnmount: () => () => {},
    },
    events: { on: (event, handler) => ((handlers[event] = handler), () => {}) },
  };
  let plugin;
  runInNewContext(await readFile(new URL('../main.js', import.meta.url), 'utf8'), {
    definePlugin: (definition) => (plugin = definition),
  });
  const stop = await plugin.activate(ctx);
  assert.equal(calls.find(([name]) => name === 'pages.register')[1].id, 'now-playing');
  assert.equal(calls.find(([name]) => name === 'layout.set')[1].order[0], 'radar');

  handlers.mount();
  await new Promise((resolve) => setTimeout(resolve, 10));
  const blocks = calls.findLast(([name]) => name === 'pages.render')[2];
  assert.ok(blocks.length <= 40);
  const list = blocks.find((block) => block.type === 'list');
  assert.ok(list.items.length <= 50);
  assert.ok(list.items.every((item) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(item.id) && item.title));
  assert.ok(list.items.find((item) => item.id === 'l61').title.startsWith('▸'));

  handlers['ui.action']({ slot: 'page', pageId: 'now-playing', id: 'seek-70' });
  handlers['ui.action']({ slot: 'page', pageId: 'other', id: 'next' });
  assert.equal(JSON.stringify(calls.filter(([name]) => name === 'seek' || name === 'next')), '[["seek",70000]]');

  await handlers['settings.changed']({ homeArrangement: 'Default' });
  assert.ok(calls.some(([name, target]) => name === 'layout.clear' && target === 'home'));
  stop();
  assert.equal(calls.filter(([name]) => name === 'warn').length, 0);
});
