import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

test('legacy name-cache records survive Zod migration and reject non-string values', async () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      return nextResolve(specifier.startsWith('.') && !/\.[a-z]+(?:\?.*)?$/i.test(specifier)
        ? `${specifier}.ts` : specifier, context);
    },
  });
  try {
    for (const [suffix, record, expected] of [
      ['valid', { 'item:100': 'Test Item', 'spell:200': 'Test Spell' }, 'Test Item'],
      ['invalid', { 'item:100': 100 }, undefined],
    ]) {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true, value: { getItem: () => JSON.stringify(record) },
      });
      const { cachedName } = await import(`../src/lib/wowheadNames.ts?${suffix}`);
      assert.equal(cachedName({ kind: 'item', id: 100 }), expected);
    }
  } finally {
    hooks.deregister();
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  }
});
