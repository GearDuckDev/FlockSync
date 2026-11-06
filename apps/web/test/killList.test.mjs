import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import { KillNoteSchema } from '@flocksync/shared-types';
import { mayChangeKill } from '../src/lib/killList.ts';

const url = new URL('../src/components/KillListCard.tsx', import.meta.url);
const historyUrl = new URL('../src/components/KillObservationHistory.tsx', import.meta.url);
const transformed = new Map(await Promise.all([url, historyUrl].map(async (file) =>
  [file.href, (await transformWithOxc(readFileSync(file, 'utf8'), file.pathname, { jsx: { runtime: 'automatic' } })).code])));
const hook = registerHooks({
  resolve(specifier, context, next) {
    return specifier === './KillObservationHistory' ? { url: historyUrl.href, shortCircuit: true } : next(specifier, context);
  },
  load(input, context, next) {
    return transformed.has(input) ? { format: 'module', shortCircuit: true, source: transformed.get(input) } : next(input, context);
  }
});
const { KillListCard } = await import(url.href);
const { KillObservationHistory, observationDate } = await import(historyUrl.href);
hook.deregister();
const entry = {
  name: '<script>Enemy One</script>', realm: 'Realm', author: 'Author One', authorGuid: 'author',
  actorGuid: 'officer', note: '<img src=x onerror=alert(1)>', createdAt: 1, updatedAt: 2, deleted: false
};
test('Kill List controls follow officer or current linked-author permission only', () => {
  assert.equal(mayChangeKill(entry, true, new Set()), true);
  assert.equal(mayChangeKill(entry, false, new Set(['author'])), true);
  assert.equal(mayChangeKill(entry, false, new Set(['officer'])), false);
  assert.equal(mayChangeKill(entry, false, new Set()), false);
  const render = (editable) => renderToStaticMarkup(createElement(KillListCard, {
    entry, observations: [], editable, disabled: false, change: () => { throw new Error('render cannot change data'); }
  }));
  assert.match(render(true), /Edit note/);
  assert.match(render(true), /Remove/);
  assert.doesNotMatch(render(false), /Edit note|>Remove</);
  assert.doesNotMatch(render(true), /<script>|<img/);
  assert.match(render(true), /&lt;script&gt;/);
});
test('history scopes creation identity, escapes evidence, shows latest sighting and paginates initial battles', () => {
  const common = { name: entry.name, realm: entry.realm, targetCreatedAt: entry.createdAt,
    targetGuid: 'enemy', reporterGuid: 'reporter', reporter: '<script>Reporter</script>', zone: '<img>Zone' };
  const observations = [
    { ...common, id: 's1', kind: 'SIGHTING', timestamp: 3 },
    { ...common, id: 's2', kind: 'SIGHTING', timestamp: 4, zone: 'Latest zone' },
    { ...common, id: 'private', kind: 'SIGHTING', timestamp: 5, name: 'Other', zone: 'WRONG_TARGET' },
    { ...common, id: 'old', kind: 'SIGHTING', timestamp: 6, targetCreatedAt: 0, zone: 'OLD_CREATION' },
    ...Array.from({ length: 25 }, (_, index) => ({ ...common, id: `b${index}`, kind: 'KILL',
      timestamp: index + 10, actor: '<script>Actor</script>', victim: 'Enemy', actorGuid: 'guild', victimGuid: 'enemy' }))
  ];
  const html = renderToStaticMarkup(createElement(KillObservationHistory, { entry, observations }));
  assert.match(html, /Latest zone/);
  assert.match(html, /Battle history \(25\)/);
  assert.match(html, /Show 20 more battles/);
  assert.equal((html.match(/<li /g) ?? []).length, 20);
  assert.doesNotMatch(html, /WRONG_TARGET|OLD_CREATION|<script>|<img>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(observationDate(new Date(2026, 10, 5, 22, 28).getTime() / 1000), /^11-05-2026 22:28$/);
});
test('note length enforces exactly 500 Unicode characters without cutting emoji', () => {
  assert.equal(KillNoteSchema.safeParse('😀'.repeat(500)).success, true);
  assert.equal(KillNoteSchema.safeParse('😀'.repeat(501)).success, false);
  assert.equal(KillNoteSchema.safeParse('line one\nline two').success, true);
  assert.equal(KillNoteSchema.safeParse('\u0000').success, false);
});
