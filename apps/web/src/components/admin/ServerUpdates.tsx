import { useEffect, useState } from 'react';
import {
  UpdateChannelSchema, type ServerUpdateStatus
} from '@flocksync/shared-types';
import { useAuth } from '../../AuthContext';
import { checkServerUpdates, fetchServerVersion } from '../../lib/apiUpdates';
import { SERVER_UPDATE_CHANGED, useServerUpdateChannel } from '../../hooks/useServerUpdateChannel';

export const ServerUpdates = (): React.JSX.Element => {
  const { token } = useAuth();
  const { channel, saveChannel, storageError } = useServerUpdateChannel();
  const [status, setStatus] = useState<ServerUpdateStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetchServerVersion(token).then((version) => {
      if (active) setCurrentVersion(version);
    }).catch((problem: unknown) => {
      if (active) setVersionError(problem instanceof Error ? problem.message : 'Unable to read server version.');
    });
    return () => { active = false; };
  }, [token]);

  const check = async (): Promise<void> => {
    if (!token || loading) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const result = await checkServerUpdates(token, channel);
      setStatus(result);
      setCurrentVersion(result.currentVersion);
      setVersionError(null);
      window.dispatchEvent(new Event(SERVER_UPDATE_CHANGED));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to check server updates.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4" aria-labelledby="server-updates">
      <h2 id="server-updates" className="text-lg font-semibold">Server / Docker update notices</h2>
      <p className="text-sm text-slate-400">
        Notices only: FlockSync never installs updates or changes running containers.
      </p>
      <p className="text-sm">Current server version: <strong>{currentVersion ?? (versionError ? 'Unknown' : 'Loading…')}</strong></p>
      {versionError && <p role="alert" className="text-sm text-red-300">Server version unavailable: {versionError}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" htmlFor="server-update-channel">Update channel</label>
        <select id="server-update-channel" value={channel} disabled={loading}
          onChange={(event) => {
            saveChannel(UpdateChannelSchema.parse(event.target.value));
            setStatus(null);
            setError(null);
          }}
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm">
          <option value="release">Release (stable only)</option>
          <option value="beta">Beta (stable + beta)</option>
          <option value="alpha">Alpha (stable + beta + alpha)</option>
        </select>
        <button onClick={() => void check()} disabled={loading || !token}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
          {loading ? 'Checking…' : 'Check for updates'}
        </button>
      </div>
      {storageError && <p className="text-xs text-amber-300">Browser storage unavailable; this channel cannot be remembered.</p>}
      <div aria-live="polite" className="space-y-2 text-sm">
        {loading && <p role="status">Checking GitHub releases…</p>}
        {error && <p role="alert" className="text-red-300">Update status unknown: {error}</p>}
        {status && <>
          {!status.latest ? <p>No published server releases match this channel.</p> : <>
            <p className={status.updateAvailable ? 'text-amber-300' : 'text-slate-300'}>
              {status.updateAvailable ? 'Update available' : 'No newer server version available'}: {status.latest.version}
              {' '}({status.latest.channel})
            </p>
            <a href={status.latest.url} target="_blank" rel="noreferrer"
              className="inline-block text-indigo-300 underline">View release and deployment notes</a>
            {status.latest.releaseNotes && <details>
              <summary className="cursor-pointer text-slate-400">Release notes</summary>
              <p className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-slate-300">{status.latest.releaseNotes}</p>
            </details>}
          </>}
        </>}
      </div>
      <p className="text-xs text-slate-400">
        To update: review the release notes, select the matching server release in your deployment
        checkout, then run sh deploy/update-server.sh from the repository root. It verifies a SQLite
        backup in your configured NAS_BACKUP_PATH before rebuilding or restarting containers, and
        stops if the backup fails. Keep a separate secure copy of your configuration.
        Beta and alpha releases may be unstable.
      </p>
    </section>
  );
};
