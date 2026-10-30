import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const { sanitizeTooltipHtml, fetchWowheadTooltip, isTouchInteraction } = await import('../src/lib/wowheadTooltip.ts');
hooks.deregister();

test('sanitizeTooltipHtml preserves WoW stat markup and strips scripts, handlers, and unsafe classes', () => {
  const dirty = [
    '<table onclick="alert(1)"><tr><td><b class="q4 evil">Perdition\'s Blade</b></td><th style="color:red">Dagger</th></tr></table>',
    '<script>window.pwned = true;</script>',
    '<img src="x" onerror="alert(2)">',
    '<a href="javascript:alert(3)" class="q2">Equip: +1% Crit</a><br>',
  ].join('');
  const clean = sanitizeTooltipHtml(dirty);
  assert.equal(clean.includes('script'), false);
  assert.equal(clean.includes('onclick'), false);
  assert.equal(clean.includes('onerror'), false);
  assert.equal(clean.includes('javascript:'), false);
  assert.equal(clean.includes('style='), false);
  assert.equal(clean.includes('evil'), false);
  assert.match(clean, /<b class="q4">Perdition's Blade<\/b>/);
  assert.match(clean, /<th>Dagger<\/th>/);
  assert.match(clean, /Equip: \+1% Crit<br \/>/);
});

test('fetchWowheadTooltip validates JSON, sanitizes HTML, and caches results', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        name: 'Thunderfury',
        quality: 5,
        icon: 'INV_Sword_39',
        tooltip: '<span class="q5">Legendary</span><script>bad()</script>',
      }),
      { status: 200 },
    );
  };
  try {
    const first = await fetchWowheadTooltip({ kind: 'item', id: 19019 });
    const second = await fetchWowheadTooltip({ kind: 'item', id: 19019 });
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    assert.equal(first?.name, 'Thunderfury');
    assert.equal(first?.color, '#ff8000');
    assert.equal(first?.iconUrl, 'https://wow.zamimg.com/images/wow/icons/medium/inv_sword_39.jpg');
    assert.equal(first?.html, '<span class="q5">Legendary</span>');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('isTouchInteraction distinguishes touch and mouse pointer types', () => {
  assert.equal(isTouchInteraction('touch'), true);
  assert.equal(isTouchInteraction('pen'), true);
  assert.equal(isTouchInteraction('mouse'), false);
});

test('PWA manifest and icons exist and declare standalone install metadata', () => {
  const publicDir = resolve(import.meta.dirname, '../public');
  const manifest = JSON.parse(readFileSync(resolve(publicDir, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(Array.isArray(manifest.icons), true);
  assert.equal(manifest.icons.length >= 2, true);
  for (const icon of manifest.icons) {
    assert.equal(existsSync(resolve(publicDir, icon.src.replace(/^\//, ''))), true, `Missing icon: ${icon.src}`);
  }
  assert.equal(existsSync(resolve(publicDir, 'sw.js')), true);
});
