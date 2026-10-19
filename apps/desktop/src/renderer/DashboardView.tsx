import { useState } from 'react';
import type { AuthUser } from '@flocksync/shared-types';
import type { AppConfig, WatcherStatus } from '../shared/ipc';
import { ActivityLog } from './ActivityLog';
import { AppSettingsCard } from './AppSettingsCard';

interface Props {
  user: AuthUser;
  config: AppConfig;
  status: WatcherStatus;
  onConfig: (config: AppConfig) => void;
  onStatus: (status: WatcherStatus) => void;
  onLogout: () => void;
}

export const DashboardView = ({ user, config, status, onConfig, onStatus, onLogout }: Props): React.JSX.Element => {
  const [wowPath, setWowPath] = useState(config.wowPath);
  const [syncing, setSyncing] = useState(false);

  const save = async (path: string): Promise<void> => {
    const next = await window.flocksync.saveConfig({ ...config, wowPath: path });
    onConfig(next.config);
    onStatus(next.status);
  };

  const browse = async (): Promise<void> => {
    const picked = await window.flocksync.selectWowFolder();
    if (picked) {
      setWowPath(picked);
      await save(picked);
    }
  };

  const syncNow = async (): Promise<void> => {
    setSyncing(true);
    await window.flocksync.triggerManualSync();
    setSyncing(false);
  };

  return (
    <div className="dashboard">
      <header>
        <h1>FlockSync</h1>
        <div className="user">
          <span className="badge role">{user.role}</span>
          <strong>{user.username}</strong>
          <button className="ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <section className="card">
        <h2>WoW Client Path</h2>
        <div className="row">
          <input value={wowPath} onChange={(e) => setWowPath(e.target.value)} onBlur={() => void save(wowPath)} />
          <button onClick={() => void browse()}>Browse...</button>
        </div>
      </section>

      <section className="card">
        <div className="row spread">
          <h2>
            <span className={`dot ${status.running ? 'on' : 'off'}`} />
            Watcher {status.running ? 'active' : 'stopped'}
          </h2>
          <button onClick={() => void syncNow()} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
        {status.files.length === 0 ? (
          <p className="muted">No FlockSync.lua files found yet. Log in to WoW and /reload once.</p>
        ) : (
          <ul className="files">
            {status.files.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </section>

      <ActivityLog />

      <AppSettingsCard />
    </div>
  );
};
