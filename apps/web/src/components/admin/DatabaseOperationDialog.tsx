import { useState } from 'react';
import type { Backup, BackupCatalog, DatabaseAdminResult } from '@flocksync/shared-types';
import { useAuth } from '../../AuthContext';
import {
  createDatabaseBackup, downloadDatabaseBackup, restoreDatabaseBackup,
  uploadDatabaseBackup, wipeDatabase
} from '../../lib/apiDatabaseAdmin';

type Operation = 'backup' | 'restore' | 'wipe';
interface Props {
  operation: Operation;
  catalog: BackupCatalog;
  onClose: () => void;
  onComplete: (result: DatabaseAdminResult) => void;
}

const SIZE_LIMIT = 128 * 1024 * 1024;
const humanSize = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const DatabaseOperationDialog = ({ operation, catalog, onClose, onComplete }: Props): React.JSX.Element => {
  const { token } = useAuth();
  const [backupName, setBackupName] = useState(catalog.backups[0]?.filename ?? '');
  const [upload, setUpload] = useState<File | null>(null);
  const [alsoDownload, setAlsoDownload] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (result: DatabaseAdminResult): Promise<void> => {
    onComplete(result);
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (operation === 'backup') {
        const result = await createDatabaseBackup(token);
        onComplete(result);
        if (alsoDownload && result.backup) {
          try {
            await downloadDatabaseBackup(token, result.backup);
          } catch (problem) {
            setError(`Server backup saved (${result.backup.filename}), but its extra download failed: ${problem instanceof Error ? problem.message : 'Download failed'}`);
            return;
          }
        }
        onClose();
      } else if (operation === 'restore') {
        const result = upload
          ? await uploadDatabaseBackup(token, upload)
          : await restoreDatabaseBackup(token, catalog.backups.find((backup) => backup.filename === backupName));
        await finish(result);
      } else {
        await finish(await wipeDatabase(token));
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Database operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const title = operation === 'backup' ? 'Create database backup'
    : operation === 'restore' ? 'Restore database backup' : 'Wipe guild data';
  const destination = `${catalog.backupRoot}${catalog.selectedDirectory ? `/${catalog.selectedDirectory}` : ''}`;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="database-operation-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="w-full max-w-xl space-y-4 rounded-lg border border-slate-700 bg-slate-950 p-5 shadow-xl">
        <div>
          <h2 id="database-operation-title" className="text-lg font-semibold">{title}</h2>
          {operation === 'backup' && <p className="mt-1 text-sm text-slate-400">
            Creates a consistent SQLite online backup while the server is running, verifies its integrity,
            and saves it to the server’s configured backup folder: <strong>{destination}</strong>.
          </p>}
          {operation === 'restore' && <p className="mt-1 text-sm text-slate-400">
            Replaces the live database with the selected complete snapshot. A pre-restore safety backup is
            created first. Accounts and all records will match the chosen snapshot; you may need to log in again.
          </p>}
          {operation === 'wipe' && <p className="mt-1 text-sm text-slate-400">
            Saves a final, integrity-checked backup, then removes guild characters, history, teams, tasks,
            aliases, and themes. Admin/user accounts and the backup folder setting are kept so you can log in.
            Addons receive a reset marker and must start with fresh data.
          </p>}
        </div>
        {operation === 'backup' && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={alsoDownload} onChange={(event) => setAlsoDownload(event.target.checked)} />
            <span>Also download a second copy to this device using the browser’s download location.</span>
          </label>
        )}
        {operation === 'restore' && <>
          <label className="block space-y-1 text-sm">
            <span>Server backup in {destination} (newest first; dates in your local time)</span>
            <select value={backupName} onChange={(event) => setBackupName(event.target.value)} disabled={busy || Boolean(upload)}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 disabled:opacity-50">
              {catalog.backups.map((backup: Backup) => (
                <option key={backup.filename} value={backup.filename}>
                  {new Date(backup.createdAt * 1000).toLocaleString()} · {backup.filename} · {humanSize(backup.size)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Or choose a custom `.db` backup from this device</span>
            <input type="file" accept=".db,application/vnd.sqlite3,application/octet-stream"
              disabled={busy} onChange={(event) => setUpload(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5" />
          </label>
          {upload && <p className={upload.size > SIZE_LIMIT ? 'text-sm text-red-300' : 'text-sm text-slate-400'}>
            Selected: {upload.name} · {humanSize(upload.size)} (maximum 128 MB)
          </p>}
          <label className="flex items-start gap-2 text-sm text-amber-200">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>I understand this replaces the current database. A pre-restore safety backup will be saved first.</span>
          </label>
        </>}
        {operation === 'wipe' && <label className="block space-y-1 text-sm">
          <span>Type WIPE to confirm this irreversible operation</span>
          <input value={wipeText} onChange={(event) => setWipeText(event.target.value)}
            className="w-full rounded border border-red-900 bg-slate-900 px-2 py-2" />
        </label>}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm">Cancel</button>
          <button type="button" disabled={busy || (operation === 'restore' && (!confirmed
            || (!upload && (!backupName || catalog.backups.length === 0)) || (upload?.size ?? 0) > SIZE_LIMIT))
            || (operation === 'wipe' && wipeText !== 'WIPE')}
            onClick={() => void submit()}
            className={`rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${operation === 'wipe' ? 'bg-red-700 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
            {busy ? 'Working…' : operation === 'backup' ? 'Create backup'
              : operation === 'restore' ? 'Restore database' : 'Back up and wipe'}
          </button>
        </div>
      </section>
    </div>
  );
};
