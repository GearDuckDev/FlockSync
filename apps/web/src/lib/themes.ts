import { ThemeStateSchema, type Theme, type ThemeState } from '@flocksync/shared-types';
import { request } from './api';

export const THEME_IMAGES = [
  { value: 'none', label: 'None' },
  { value: 'alliance', label: 'Alliance' },
  { value: 'horde', label: 'Horde' },
  { value: 'warcraft', label: 'World of Warcraft' },
  { value: 'custom', label: 'Custom image' },
] as const;

export const themeImageUrl = (theme: Theme): string | undefined => {
  if (theme.image === 'none') return undefined;
  if (theme.image === 'custom') return theme.customImage;
  return `/themes/${theme.image}.png`;
};

export const fetchThemes = async (token: string): Promise<ThemeState> =>
  ThemeStateSchema.parse(await request('/themes', {}, token));

export const saveTheme = async (token: string, scope: 'me' | 'default', theme: Theme | null): Promise<ThemeState> =>
  ThemeStateSchema.parse(await request(`/themes/${scope}`, { method: 'PUT', body: JSON.stringify(theme) }, token));

export const readThemeImage = async (file: File): Promise<string> => {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Choose a PNG or JPEG image no larger than 5 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image conversion is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let result = canvas.toDataURL('image/png');
    if (result.length > 750_000) result = canvas.toDataURL('image/jpeg', 0.8);
    if (result.length > 750_000) throw new Error('Image is too complex. Choose a smaller image.');
    return result;
  } finally {
    bitmap.close();
  }
};
