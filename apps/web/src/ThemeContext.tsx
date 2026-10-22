import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_THEME, type Theme, type ThemeState } from '@flocksync/shared-types';
import { useAuth } from './AuthContext';
import { fetchThemes, saveTheme, themeImageUrl } from './lib/themes';
import { ApiError } from './lib/api';
import { themeColorStyle } from './lib/themeColors';

interface ThemeContextValue {
  state: ThemeState;
  loading: boolean;
  error: string | null;
  save: (scope: 'me' | 'default', theme: Theme | null) => Promise<void>;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
  const { token, logout } = useAuth();
  const [state, setState] = useState<ThemeState>({ defaultTheme: DEFAULT_THEME, userTheme: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const accept = useCallback((next: ThemeState): void => {
    setState((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    setError(null);
  }, []);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const refresh = async (): Promise<void> => {
      try {
        const next = await fetchThemes(token);
        if (!cancelled) accept(next);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) logout();
          else setError(err instanceof Error ? err.message : 'Cannot load theme settings.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 60_000);
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [token, accept, logout]);
  const save = async (scope: 'me' | 'default', theme: Theme | null): Promise<void> => {
    if (!token) { logout(); throw new Error('Sign in to save your theme.'); }
    try {
      accept(await saveTheme(token, scope, theme));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      throw err;
    }
  };
  const effective = state.userTheme ?? state.defaultTheme;
  const image = themeImageUrl(effective);
  return (
    <ThemeContext.Provider value={{ state, loading, error, save }}>
      <div className="flocksync-theme relative isolate min-h-screen" style={themeColorStyle(effective)}>
        {image && <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center">
          <img src={image} alt="" className="max-h-[80vh] max-w-[85vw] object-contain" style={{ opacity: effective.opacity }} />
        </div>}
        {error && <div role="alert" className="mx-auto max-w-7xl px-5 pt-3 text-sm text-amber-300">
          Theme settings could not be loaded: {error}
        </div>}
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
