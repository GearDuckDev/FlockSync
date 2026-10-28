import { useEffect, useState } from 'react';
import { Folder } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import {
  createBackupDirectory, fetchDatabaseBackupCatalog, saveBackupDirectory
} from '../../lib/apiDatabaseAdmin';
import type { BackupCatalog } from '@flocksync/shared-types';

interface Props {
  initial: BackupCatalog | null;
  onClose: () => void;
  onSaved: (catalog: BackupCatalog) => void;
}

const parentOf = (directory: string): string => directory.split('/').slice(0, -1).join('/');
const emptyCatalog: BackupCatalog = {
  backupRoot: '/backups',
  selectedDirectory: '',
  directories: [],
  backups: []
};

export const BackupLocationDialog = ({ initial, onClose, onSaved }: Props): React.JSX.Element => {
  const { token } = useAuth();
  const [directory, setDirectory] = useState(initial?.selectedDirectory ?? '');
  const [catalog, setCatalog] = useState(initial ?? emptyCatalog);
  const [newFolder, setNewFolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetchDatabaseBackupCatalog(token, directory).then(setCatalog).catch((problem: unknown) => {
      setError(problem instanceof Error ? problem.message : 'Unable to browse the backup folder.');
    });
  }, [directory, token]);

  const createFolder = async (): Promise<void> => {
    if (!token || !newFolder.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const path = directory ? `${directory}/${newFolder.trim()}` : newFolder.trim();
      const updated = await createBackupDirectory(token, path);
      setNewFolder('');
      setDirectory(path);
      setCatalog(updated);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to create the folder.');
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<void> => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await saveBackupDirectory(token, directory));
      onClose();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to save the backup folder.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="backup-location-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="w-full max-w-lg space-y-4 rounded-lg border border-slate-700 bg-slate-950 p-5 shadow-xl">
        <div>
          <h2 id="backup-location-title" className="text-lg font-semibold">Default server backup folder</h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose a folder on the server’s mounted backup volume. This setting is stored with persistent
            server data and survives web/API image updates. It cannot select an unmounted remote server path.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            This browser lists folders on the remote server, not your Windows PC. A native Windows folder picker
            cannot choose the server backup destination. /backups is the container path to your configured backup storage share.
          </p>
        </div>
        {!initial && <p className="text-sm text-amber-200">
          The saved backup folder could not be loaded. Browse from the mounted root and choose an available folder.
        </p>}
        <p className="text-xs text-slate-400">Mounted backup root: {catalog.backupRoot}</p>
        <div className="flex items-center justify-between gap-2 rounded border border-slate-800 p-2 text-sm">
          <span className="min-w-0 break-all">{catalog.backupRoot}{directory ? `/${directory}` : ''}</span>
          {directory && <button type="button" disabled={busy} onClick={() => setDirectory(parentOf(directory))}
            className="shrink-0 rounded border border-slate-700 px-2 py-1 hover:bg-slate-800">Up</button>}
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {catalog.directories.map((path) => {
            const name = path.split('/').at(-1) ?? path;
            return <button key={path} type="button" disabled={busy} onClick={() => setDirectory(path)}
              className="block w-full rounded px-2 py-1 text-left text-sm text-indigo-300 hover:bg-slate-800">
              <span className="inline-flex items-center gap-2"><Folder size={14} /> {name}</span>
            </button>;
          })}
          {catalog.directories.length === 0 && <p className="text-sm text-slate-500">No subfolders here.</p>}
        </div>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void createFolder(); }}>
          <input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} maxLength={80}
            placeholder="New subfolder name" aria-label="New subfolder name"
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
          <button disabled={busy || !newFolder.trim()} className="rounded border border-slate-700 px-3 py-1 text-sm disabled:opacity-50">
            Create
          </button>
        </form>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm">Cancel</button>
          <button type="button" disabled={busy} onClick={() => void save()}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
            {busy ? 'Saving…' : 'Use this folder'}
          </button>
        </div>
      </section>
    </div>
  );
};
