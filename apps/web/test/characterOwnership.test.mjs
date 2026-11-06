import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import { prepareOwnershipChange, prepareGroupOwnershipChange } from '../src/lib/characterOwnership.ts';

const compiled = new Map();
for (const name of ['CharacterOwnershipPanel', 'CharacterOwnershipAudit', 'DashboardNav']) {
  const url = new URL(`../src/components/${name}.tsx`, import.meta.url);
  const transformed = await transformWithOxc(readFileSync(url, 'utf8'), url.pathname, {
    jsx: { runtime: 'automatic' }
  });
  compiled.set(url.href, transformed.code);
}
const hook = registerHooks({
  load(url, context, nextLoad) {
    const source = compiled.get(url);
    return source === undefined ? nextLoad(url, context) : { format: 'module', shortCircuit: true, source };
  }
});
const { CharacterOwnershipPanel } = await import('../src/components/CharacterOwnershipPanel.tsx');
const { CharacterOwnershipAudit } = await import('../src/components/CharacterOwnershipAudit.tsx');
const { TABS } = await import('../src/components/DashboardNav.tsx');
hook.deregister();

const revision = 'be7dc6d2-cbe1-41c4-b01e-af76b4db60f6';
const catalog = {
  guild: { name: 'Test Guild', realm: 'Realm' },
  users: [{ id: 'alice', username: 'Alice' }, { id: 'bob', username: 'Bob' }],
  characters: [
    { guid: 'first', name: 'First Last', realm: 'Realm', isActive: true },
    { guid: 'second', name: 'Second Last', realm: 'Realm', isActive: false }
  ],
  ownerships: [{ characterGuid: 'first', userId: 'alice', revision, updatedAt: 1 }],
  groups: [
    { key: 'first', label: 'Killjoy', characterGuids: ['first', 'second'], userId: 'alice', revision }
  ],
  audit: []
};

test('ownership changes carry concurrency state and explicitly name old/new owners', () => {
  const transfer = prepareOwnershipChange(catalog, 'first', 'bob');
  assert.deepEqual(transfer.input, { userId: 'bob', expectedRevision: revision, confirmReassignment: true });
  assert.match(transfer.confirmation, /from "Alice" to "Bob"/);
  assert.match(transfer.confirmation, /Historical authors will not change/);
  const revoke = prepareOwnershipChange(catalog, 'first', null);
  assert.equal(revoke.input.expectedRevision, revision);
  assert.match(revoke.confirmation, /Revoke.*Alice/);
  const assign = prepareOwnershipChange(catalog, 'second', 'bob');
  assert.equal(assign.input.expectedRevision, null);
  assert.equal(assign.input.confirmReassignment, false);
  assert.throws(() => prepareOwnershipChange(catalog, 'missing', 'bob'), /Refresh/);
  assert.throws(() => prepareOwnershipChange(catalog, 'first', 'missing'), /Refresh/);
});

test('responsive ownership controls show all characters, current owner and disabled saving state', () => {
  const html = renderToStaticMarkup(createElement(CharacterOwnershipPanel, {
    catalog, busy: true, onChange: () => { throw new Error('render must not mutate'); }
  }));
  assert.match(html, /First Last/);
  assert.match(html, /Second Last/);
  assert.match(html, /Inactive/);
  assert.match(html, /value="alice" selected/);
  assert.match(html, /Killjoy/);
  assert.match(html, /including future alts/);
  assert.equal((html.match(/<select disabled/g) ?? []).length, 1);
  assert.equal(TABS.find((tab) => tab.id === 'characters').access, 'officer');
});

test('friendly-group changes confirm all characters, previous owners and automatic future ownership', () => {
  const prepared = prepareGroupOwnershipChange(catalog, 'first', 'bob');
  assert.equal(prepared.input.groupKey, 'first');
  assert.equal(prepared.input.expectedRevision, revision);
  assert.deepEqual(prepared.input.expectedMembers, [
    { characterGuid: 'first', revision }, { characterGuid: 'second', revision: null }
  ]);
  assert.equal(prepared.input.confirmReassignment, true);
  assert.match(prepared.confirmation, /Killjoy/);
  assert.match(prepared.confirmation, /First Last: Alice/);
  assert.match(prepared.confirmation, /Second Last: Unlinked/);
  assert.match(prepared.confirmation, /future synced/);
  assert.match(prepareGroupOwnershipChange(catalog, 'first', null).confirmation, /future characters will not inherit/);
});

test('audit renders historical names safely instead of substituting current usernames', () => {
  const html = renderToStaticMarkup(createElement(CharacterOwnershipAudit, {
    entries: [{
      id: revision, characterGuid: 'first', characterName: '<script>First Last</script>',
      previousUserId: 'alice', previousUsername: 'Old Alice', userId: 'bob', username: 'Old Bob',
      actorId: 'officer', actorUsername: 'Old Officer', changedAt: 100, reason: 'REASSIGNED'
    }]
  }));
  assert.match(html, /Old Alice/);
  assert.match(html, /Old Bob/);
  assert.match(html, /Old Officer/);
  assert.ok(!html.includes('<script>'));
});
