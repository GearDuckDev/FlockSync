import { useEffect, useState } from 'react';
import type { ServerUpdateStatus } from '@flocksync/shared-types';
import { useAuth } from '../AuthContext';
import { checkServerUpdates } from '../lib/apiUpdates';
import { SERVER_UPDATE_CHANGED, useServerUpdateChannel } from '../hooks/useServerUpdateChannel';

export const ServerUpdateBanner = (): React.JSX.Element | null => {
  const { token, user } = useAuth();
  const { channel } = useServerUpdateChannel();
  const [status, setStatus] = useState<ServerUpdateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    let active = true;
    let checking = false;
    const check = async (): Promise<void> => {
      if (checking) return;
      checking = true;
      try {
        const next = await checkServerUpdates(token, channel);
        if (active) { setStatus(next); setError(null); }
      } catch (problem) {
        if (active) {
          setStatus(null);
          setError(problem instanceof Error ? problem.message : 'Unable to check server updates.');
        }
      } finally {
        checking = false;
      }
    };
    setStatus(null);
    setError(null);
    void check();
    const refresh = (): void => { void check(); };
    const interval = window.setInterval(refresh, 6 * 60 * 60 * 1000);
    window.addEventListener(SERVER_UPDATE_CHANGED, refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener(SERVER_UPDATE_CHANGED, refresh);
    };
  }, [token, channel]);

  if (error) return (
    <div className="flex justify-end">
      <p className="text-xs text-slate-400" title={error}>Server update status unavailable</p>
    </div>
  );
  if (!status?.updateAvailable || !status.latest) return null;
  return (
    <div className="flex justify-end">
      <aside role="status" aria-label="Server update available"
        className="max-w-sm rounded-md border border-amber-700/60 bg-amber-950/50 px-3 py-2 text-xs text-amber-200">
        <a href={status.latest.url} target="_blank" rel="noreferrer" className="font-semibold underline">
          Web / API update available: v{status.latest.version}
        </a>
        <p className="mt-0.5 text-amber-200/80">
          {user?.role === 'ADMIN'
            ? 'Review the release notes and use the backed-up server update script.'
            : 'Your server administrator can install this update.'}
        </p>
      </aside>
    </div>
  );
};
