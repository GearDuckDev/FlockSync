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
const transformed = await transformWithOxc(readFileSync(url, 'utf8'), url.pathname, { jsx: { runtime: 'automatic' } });
const hook = registerHooks({
  load(input, context, next) {
    return input === url.href ? { format: 'module', shortCircuit: true, source: transformed.code } : next(input, context);
  }
});
const { KillListCard } = await import(url.href);
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
    entry, editable, disabled: false, change: () => { throw new Error('render cannot change data'); }
  }));
  assert.match(render(true), /Edit note/);
  assert.match(render(true), /Remove/);
  assert.doesNotMatch(render(false), /Edit note|>Remove</);
  assert.doesNotMatch(render(true), /<script>|<img/);
  assert.match(render(true), /&lt;script&gt;/);
});
test('note length enforces exactly 500 Unicode characters without cutting emoji', () => {
  assert.equal(KillNoteSchema.safeParse('😀'.repeat(500)).success, true);
  assert.equal(KillNoteSchema.safeParse('😀'.repeat(501)).success, false);
  assert.equal(KillNoteSchema.safeParse('line one\nline two').success, true);
  assert.equal(KillNoteSchema.safeParse('\u0000').success, false);
});
