import { DEFAULT_THEME_COLOR, type Theme } from '@flocksync/shared-types';
import type { CSSProperties } from 'react';

export const themeColors = (theme: Theme): { ui: string; background: string } => {
  const ui = theme.uiColor ?? DEFAULT_THEME_COLOR;
  return { ui, background: theme.separateColors ? theme.backgroundColor ?? ui : ui };
};

const channels = (color: string): number[] =>
  [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));

const foreground = (color: string): string => {
  const linear = channels(color).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = linear.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  return luminance > 0.179 ? '#000000' : '#ffffff';
};

const mix = (base: string, target: string, amount: number): string => {
  const end = channels(target);
  return `#${channels(base).map((value, index) =>
    Math.round(value + (end[index]! - value) * amount).toString(16).padStart(2, '0')).join('')}`;
};

type ThemeStyle = CSSProperties & { [key: `--${string}`]: string };

export const themeColorStyle = (theme: Theme): ThemeStyle => {
  const { ui, background } = themeColors(theme);
  // Reset the palette too, so an unchanged preview cannot inherit a different personal theme.
  const style: ThemeStyle = {
    '--theme-background': background,
    '--theme-text': theme.uiColor || theme.backgroundColor ? foreground(background) : 'var(--color-slate-100)',
    '--color-slate-100': 'oklch(96.8% 0.007 247.896)',
    '--color-slate-200': 'oklch(92.9% 0.013 255.508)',
    '--color-slate-300': 'oklch(86.9% 0.022 252.894)',
    '--color-slate-400': 'oklch(70.4% 0.04 256.788)',
    '--color-slate-500': 'oklch(55.4% 0.046 257.417)',
    '--color-slate-600': 'oklch(44.6% 0.043 257.281)',
    '--color-slate-700': 'oklch(37.2% 0.044 257.287)',
    '--color-slate-800': 'oklch(27.9% 0.041 260.031)',
    '--color-slate-900': 'oklch(20.8% 0.042 265.755)',
    '--color-slate-950': 'oklch(12.9% 0.042 264.695)',
  };
  for (const shade of [100, 200, 300, 400, 500] as const) {
    style[`--theme-ui-text-${shade}`] = style[`--color-slate-${shade}`]!;
  }
  if (!theme.uiColor && !theme.backgroundColor) return style;
  const text = foreground(ui);
  const tint = text === '#ffffff' ? '#ffffff' : '#000000';
  if (theme.uiColor) {
    for (const [shade, amount] of [[950, 0], [900, 0.06], [800, 0.12], [700, 0.23], [600, 0.4]] as const) {
      style[`--color-slate-${shade}`] = mix(ui, tint, amount);
    }
  }
  for (const [shade, amount] of [[100, 1], [200, 0.95], [300, 0.9], [400, 0.85], [500, 0.8]] as const) {
    style[`--color-slate-${shade}`] = mix(background, foreground(background), amount);
    if (theme.uiColor) style[`--theme-ui-text-${shade}`] = mix(ui, text, amount);
  }
  return style;
};
