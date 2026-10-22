import { useEffect, useId, useState } from 'react';
import { ThemeImageSchema, type Theme } from '@flocksync/shared-types';
import { readThemeImage, THEME_IMAGES, themeImageUrl } from '../lib/themes';

interface Props {
  title: string;
  theme: Theme;
  disabled: boolean;
  onSave: (theme: Theme) => Promise<void>;
}

export const ThemeEditor = ({ title, theme, disabled, onSave }: Props): React.JSX.Element => {
  const [draft, setDraft] = useState(theme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const id = useId();
  useEffect(() => { setDraft(theme); setSaved(false); }, [theme]);
  const upload = async (file: File): Promise<void> => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const customImage = await readThemeImage(file);
      setDraft((current) => ({ ...current, image: 'custom', customImage }));
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Cannot read image.'); }
    finally { setBusy(false); }
  };
  const persist = async (): Promise<void> => {
    setBusy(true); setError(null); setSaved(false);
    try { await onSave(draft); setSaved(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Cannot save theme.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/90 p-4">
      <h2 className="font-semibold">{title}</h2>
      <fieldset disabled={disabled || busy} className="space-y-3 disabled:opacity-60">
        <label htmlFor={`${id}-image`} className="block text-sm">Background emblem</label>
        <select id={`${id}-image`} value={draft.image}
          onChange={(event) => {
            const image = ThemeImageSchema.parse(event.target.value);
            setDraft({ image, opacity: draft.opacity, ...(image === 'custom' && draft.customImage ? { customImage: draft.customImage } : {}) });
            setSaved(false);
          }} className="w-full rounded border border-slate-700 bg-slate-950 p-2">
          {THEME_IMAGES.map((image) => <option key={image.value} value={image.value}>{image.label}</option>)}
        </select>
        {draft.image === 'custom' && <label className="block text-sm">
          Upload PNG or JPEG (up to 5 MB; resized for storage)
          <input type="file" accept="image/png,image/jpeg" className="mt-1 block w-full text-xs"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }} />
        </label>}
        <label htmlFor={`${id}-opacity`} className="block text-sm">Emblem opacity: {Math.round(draft.opacity * 100)}% (lower is more transparent)</label>
        <input id={`${id}-opacity`} type="range" min="0" max="40" step="1"
          value={Math.round(draft.opacity * 100)} className="w-full"
          onChange={(event) => { setDraft({ ...draft, opacity: Number(event.target.value) / 100 }); setSaved(false); }} />
        <div className="flex h-36 items-center justify-center rounded bg-slate-950" aria-label="Theme preview">
          {themeImageUrl(draft) && <img src={themeImageUrl(draft)} alt="Background emblem preview"
            className="max-h-full max-w-full object-contain" style={{ opacity: draft.opacity }} />}
        </div>
        <button type="button" onClick={() => void persist()} disabled={draft.image === 'custom' && !draft.customImage}
          className="rounded bg-indigo-600 px-3 py-2 text-sm disabled:opacity-50">{busy ? 'Saving...' : 'Save theme'}</button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-300">Theme saved.</p>}
    </section>
  );
};
