import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_THEME, ThemeSchema } from '@flocksync/shared-types';
import { themeColors, themeColorStyle } from '../src/lib/themeColors.ts';

test('legacy themes keep the original appearance and start with linked colors', () => {
  assert.deepEqual(ThemeSchema.parse(DEFAULT_THEME), { image: 'none', opacity: 0.12 });
  assert.deepEqual(themeColors(DEFAULT_THEME), { ui: '#020617', background: '#020617' });
  assert.equal(themeColorStyle(DEFAULT_THEME)['--color-slate-900'], 'oklch(20.8% 0.042 265.755)');
});

test('linked colors ignore an independently stored background until separated', () => {
  const theme = { ...DEFAULT_THEME, uiColor: '#123456', backgroundColor: '#fedcba' };
  assert.deepEqual(themeColors(theme), { ui: '#123456', background: '#123456' });
  assert.deepEqual(themeColors({ ...theme, separateColors: true }), { ui: '#123456', background: '#fedcba' });
  assert.deepEqual(themeColors({ ...DEFAULT_THEME, separateColors: true }), { ui: '#020617', background: '#020617' });
});

test('custom surfaces and separate page backgrounds are scoped independently', () => {
  const style = themeColorStyle({ ...DEFAULT_THEME, uiColor: '#123456', backgroundColor: '#fedcba', separateColors: true });
  assert.equal(style['--theme-background'], '#fedcba');
  assert.equal(style['--color-slate-950'], '#123456');
  assert.equal(style['--theme-text'], '#000000');
  assert.equal(style['--color-slate-100'], '#000000');
  assert.equal(style['--theme-ui-text-100'], '#ffffff');
  assert.notEqual(style['--color-slate-900'], style['--color-slate-950']);
  assert.equal(style['--color-indigo-600'], undefined, 'Action colors are not overridden');
});

test('neutral text follows light and dark UI colors', () => {
  for (const [uiColor, expected] of [['#ffffff', '#000000'], ['#000000', '#ffffff'], ['#ffff00', '#000000']]) {
    const style = themeColorStyle({ ...DEFAULT_THEME, uiColor });
    assert.equal(style['--color-slate-100'], expected);
    assert.equal(style['--theme-text'], expected);
  }
});

test('theme boundary validates colors and the toggle without breaking legacy or custom images', () => {
  for (const color of ['#000000', '#FFFFFF', '#12abEF']) {
    assert.equal(ThemeSchema.safeParse({ ...DEFAULT_THEME, uiColor: color, backgroundColor: color, separateColors: true }).success, true);
  }
  for (const color of ['red', '#fff', '#12345678', 'url(https://example.com)', '#zzzzzz', '', null, 123456]) {
    for (const field of ['uiColor', 'backgroundColor']) {
      assert.equal(ThemeSchema.safeParse({ ...DEFAULT_THEME, [field]: color }).success, false);
    }
  }
  assert.equal(ThemeSchema.safeParse({ ...DEFAULT_THEME, separateColors: 'true' }).success, false);
});
