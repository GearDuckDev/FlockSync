import { useState } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { ThemeEditor } from './components/ThemeEditor';

export const ThemeSettingsPage = (): React.JSX.Element => {
  const { user } = useAuth();
  const { state, loading, error, save } = useTheme();
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const reset = async (): Promise<void> => {
    setResetting(true); setResetError(null);
    try { await save('me', null); }
    catch (err) { setResetError(err instanceof Error ? err.message : 'Cannot restore server theme.'); }
    finally { setResetting(false); }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Theme settings</h1>
      <p className="text-sm text-slate-400">
        {state.userTheme ? 'Using your personal theme.' : 'Following the server default.'} Personal themes follow your website account across browsers.
        Server changes appear on next focus or within a minute. Backgrounds are decorative and capped at 40% opacity for readability.
        UI and background colors are linked by default; enable the separate-colors toggle to choose them independently.
      </p>
      {error && <p role="alert" className="text-sm text-red-300">Theme settings unavailable: {error}</p>}
      <ThemeEditor title="Your theme" theme={state.userTheme ?? state.defaultTheme} disabled={loading || error !== null}
        onSave={(theme) => save('me', theme)} />
      <button type="button" disabled={loading || resetting || state.userTheme === null}
        onClick={() => void reset()} className="rounded border border-slate-700 px-3 py-2 text-sm disabled:opacity-50">
        Use server default
      </button>
      {resetError && <p role="alert" className="text-sm text-red-300">{resetError}</p>}
      {user?.role === 'ADMIN' && <>
        <p className="text-sm text-slate-400">Server default: applies to everyone without a personal override. This does not replace personal themes.</p>
        <ThemeEditor title="Server default theme (admin)" theme={state.defaultTheme} disabled={loading || error !== null}
          onSave={(theme) => save('default', theme)} />
      </>}
    </div>
  );
};
