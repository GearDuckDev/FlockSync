import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { transformWithOxc } from 'vite';

const url = new URL('../src/components/DashboardNav.tsx', import.meta.url);
const transformed = await transformWithOxc(readFileSync(url, 'utf8'), url.pathname, {
  jsx: { runtime: 'automatic' }
});
const hook = registerHooks({
  load(input, context, next) {
    return input === url.href
      ? { format: 'module', shortCircuit: true, source: transformed.code }
      : next(input, context);
  }
});
const { TABS } = await import(url.href);
hook.deregister();

test('dashboard no longer exposes character-to-account linking controls', () => {
  assert.ok(!TABS.some((tab) => tab.id === 'characters'));
  assert.ok(TABS.some((tab) => tab.id === 'kills'));
});
