import { useEffect, useRef, useState } from 'react';
import type { UpdateChannel } from '@flocksync/shared-types';
import type { AppSettings, UpdateCheckResult } from '../shared/ipc';

const describeResult = (result: UpdateCheckResult): string => {
  switch (result.status) {
    case 'available':
      return `Version ${result.update.version} (${result.update.channel}) is available.`;
    case 'up-to-date':
      return `You're on the latest version (v${result.currentVersion}).`;
    case 'error':
      return `Update check failed: ${result.message}`;
    case 'skipped':
      return '';
  }
};

export const AppSettingsCard = (): React.JSX.Element => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const checkGeneration = useRef(0);

  useEffect(() => {
    void window.flocksync.getAppSettings().then((s) => {
      setSettings(s.settings);
      setAppVersion(s.appVersion);
    });
    // Keeps the checkboxes in sync with toggles made from the tray menu.
    return window.flocksync.onAppSettings((next) => {
      checkGeneration.current++;
      setCheckMessage('');
      setChecking(false);
      setSettings(next);
    });
  }, []);

  const toggle = async (key: 'startOnBoot' | 'minimizeToTray', value: boolean): Promise<void> => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    const next = await window.flocksync.saveAppSettings({ ...settings, [key]: value });
    setSettings(next.settings);
  };

  const changeChannel = async (updateChannel: UpdateChannel): Promise<void> => {
    if (!settings) return;
    checkGeneration.current++;
    setCheckMessage('');
    setChecking(false);
    setSettings({ ...settings, updateChannel });
    const next = await window.flocksync.saveAppSettings({ ...settings, updateChannel });
    setSettings(next.settings);
  };

  const checkNow = async (): Promise<void> => {
    const generation = ++checkGeneration.current;
    setChecking(true);
    setCheckMessage('');
    const result = await window.flocksync.checkForUpdates();
    if (generation !== checkGeneration.current) return;
    setCheckMessage(describeResult(result));
    setChecking(false);
  };

  return (
    <section className="card">
      <h2>App Settings</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={settings?.startOnBoot ?? false}
          disabled={!settings}
          onChange={(e) => void toggle('startOnBoot', e.target.checked)}
        />
        Launch on Windows startup
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={settings?.minimizeToTray ?? false}
          disabled={!settings}
          onChange={(e) => void toggle('minimizeToTray', e.target.checked)}
        />
        Minimize to system tray on close
      </label>
      <label className="check">
        Update channel
        <select
          value={settings?.updateChannel ?? 'release'}
          disabled={!settings}
          onChange={(e) => void changeChannel(e.target.value as UpdateChannel)}
        >
          <option value="release">Release</option>
          <option value="beta">Beta (includes releases)</option>
          <option value="alpha">Alpha (includes beta and releases)</option>
        </select>
      </label>
      <div className="row update-row">
        <button className="ghost" onClick={() => void checkNow()} disabled={checking}>
          {checking ? 'Checking…' : 'Check for Updates'}
        </button>
        <span className="muted">Current version: v{appVersion || '…'}</span>
      </div>
      {checkMessage && <p className="muted check-result">{checkMessage}</p>}
    </section>
  );
};
