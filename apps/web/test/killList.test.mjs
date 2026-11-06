import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import { KillNoteSchema } from '@flocksync/shared-types';

const url = new URL('../src/components/KillListCard.tsx', import.meta.url);
const historyUrl = new URL('../src/components/KillObservationHistory.tsx', import.meta.url);
const createUrl = new URL('../src/components/KillListCreateForm.tsx', import.meta.url);
const transformed = new Map(await Promise.all([url, historyUrl, createUrl].map(async (file) =>
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
const { KillListCreateForm } = await import(createUrl.href);
hook.deregister();
const entry = {
  name: '<script>Enemy One</script>', realm: 'Realm', author: 'Author One', authorGuid: 'author',
  actorGuid: 'officer', note: '<img src=x onerror=alert(1)>', createdAt: 1, updatedAt: 2, deleted: false
};
test('signed-in Kill List users can edit or remove entries and add a target', () => {
  const html = renderToStaticMarkup(createElement(KillListCard, {
    entry, observations: [], disabled: false, change: () => { throw new Error('render cannot change data'); }
  }));
  assert.match(html, /Edit note/);
  assert.match(html, /Remove/);
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
  const form = renderToStaticMarkup(createElement(KillListCreateForm, {
    disabled: false, onAdd: async () => { throw new Error('render must not submit'); }
  }));
  assert.match(form, /Character name/);
  assert.match(form, /Reason \(optional; up to 500 characters\)/);
  assert.match(form, /Add target/);
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
