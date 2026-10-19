import { useEffect, useState } from 'react';
import type { AppSettings, UpdateCheckResult } from '../shared/ipc';

const describeResult = (result: UpdateCheckResult): string => {
  switch (result.status) {
    case 'available':
      return `Version ${result.update.version} is available.`;
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

  useEffect(() => {
    void window.flocksync.getAppSettings().then((s) => {
      setSettings(s.settings);
      setAppVersion(s.appVersion);
    });
    // Keeps the checkboxes in sync with toggles made from the tray menu.
    return window.flocksync.onAppSettings(setSettings);
  }, []);

  const toggle = async (key: keyof AppSettings, value: boolean): Promise<void> => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    const next = await window.flocksync.saveAppSettings({ ...settings, [key]: value });
    setSettings(next.settings);
  };

  const checkNow = async (): Promise<void> => {
    setChecking(true);
    setCheckMessage('');
    const result = await window.flocksync.checkForUpdates();
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
