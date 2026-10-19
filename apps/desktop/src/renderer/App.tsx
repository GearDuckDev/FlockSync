import { useEffect, useState } from 'react';
import type { AuthUser } from '@flocksync/shared-types';
import type { AppConfig, WatcherStatus } from '../shared/ipc';
import { DEFAULT_API_URL, DEFAULT_WOW_PATH } from '../shared/ipc';
import { LoginView } from './LoginView';
import { DashboardView } from './DashboardView';
import { UpdateBanner } from './UpdateBanner';

const emptyStatus: WatcherStatus = { running: false, files: [] };

export const App = (): React.JSX.Element => {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [config, setConfig] = useState<AppConfig>({ apiBaseUrl: DEFAULT_API_URL, wowPath: DEFAULT_WOW_PATH });
  const [status, setStatus] = useState<WatcherStatus>(emptyStatus);

  useEffect(() => {
    void window.flocksync.getConfig().then((s) => {
      setConfig(s.config);
      setUser(s.user);
      setStatus(s.status);
      setLoaded(true);
    });
    return window.flocksync.onStatus(setStatus);
  }, []);

  if (!loaded) return <div className="center muted">Loading…</div>;

  const view = user ? (
    <DashboardView
      user={user}
      config={config}
      status={status}
      onConfig={setConfig}
      onStatus={setStatus}
      onLogout={() => {
        void window.flocksync.logout().then(() => {
          setUser(null);
          setStatus(emptyStatus);
        });
      }}
    />
  ) : (
    <LoginView
      initialUrl={config.apiBaseUrl}
      onLoggedIn={(u, apiBaseUrl) => {
        setConfig({ ...config, apiBaseUrl });
        setUser(u);
        void window.flocksync.getConfig().then((s) => setStatus(s.status));
      }}
    />
  );

  return (
    <>
      <UpdateBanner />
      {view}
    </>
  );
};
