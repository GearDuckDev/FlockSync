import { useEffect, useState } from 'react';
import type { UpdateInfo } from '../shared/ipc';

export const UpdateBanner = (): React.JSX.Element | null => {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let active = true;
    void window.flocksync.getAppSettings().then((s) => {
      if (active && s.pendingUpdate) setUpdate((current) => current ?? s.pendingUpdate);
    });
    const unsubscribe = window.flocksync.onUpdateAvailable(setUpdate);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!update) return null;

  const remindLater = (): void => {
    setUpdate(null);
    window.flocksync.dismissUpdate();
  };

  return (
    <div className="update-banner" role="status">
      <div className="row spread">
        <strong>FlockSync v{update.version} is available!</strong>
        <div className="row">
          <button onClick={() => void window.flocksync.openExternalUrl(update.url)}>Download on GitHub</button>
          <button className="ghost" onClick={remindLater}>
            Remind Me Later
          </button>
        </div>
      </div>
      {update.releaseNotes.trim() && (
        <details>
          <summary>Release notes</summary>
          <pre>{update.releaseNotes.trim()}</pre>
        </details>
      )}
    </div>
  );
};
