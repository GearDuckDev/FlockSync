import { useEffect, useState } from 'react';
import type { UpdateInfo } from '../shared/ipc';

export const UpdateBanner = (): React.JSX.Element | null => {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let active = true;
    let receivedUpdateEvent = false;
    void window.flocksync.getAppSettings().then((s) => {
      if (active && !receivedUpdateEvent) setUpdate(s.pendingUpdate);
    });
    const unsubscribe = window.flocksync.onUpdateAvailable((next) => {
      receivedUpdateEvent = true;
      setUpdate(next);
    });
    const unsubscribeClear = window.flocksync.onUpdateNotAvailable(() => {
      receivedUpdateEvent = true;
      setUpdate(null);
    });
    return () => {
      active = false;
      unsubscribe();
      unsubscribeClear();
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
        <strong>FlockSync v{update.version} ({update.channel}) is available!</strong>
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
