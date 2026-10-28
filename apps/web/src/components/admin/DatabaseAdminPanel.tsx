import { useCallback, useEffect, useState } from 'react';
import { Archive, FolderCog, RotateCcw, Trash2 } from 'lucide-react';
import type { BackupCatalog, DatabaseAdminResult } from '@flocksync/shared-types';
import { useAuth } from '../../AuthContext';
import { fetchDatabaseBackupCatalog } from '../../lib/apiDatabaseAdmin';
import { BackupLocationDialog } from './BackupLocationDialog';
import { DatabaseOperationDialog } from './DatabaseOperationDialog';

type Operation = 'backup' | 'restore' | 'wipe';

export const DatabaseAdminPanel = (): React.JSX.Element => {
  const { token } = useAuth();
  const [catalog, setCatalog] = useState<BackupCatalog | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [choosingLocation, setChoosingLocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async (clearNotice = true) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    if (clearNotice) setNotice(null);
    try {
      setCatalog(await fetchDatabaseBackupCatalog(token));
    } catch (problem) {
      setCatalog(null);
      setError(problem instanceof Error ? problem.message : 'Unable to load database backups.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  const complete = (result: DatabaseAdminResult): void => {
    if (result.databaseResetAt > 0) {
      window.location.reload();
      return;
    }
    setNotice(result.backup ? `Backup saved: ${result.backup.filename}` : 'Database backup completed.');
    void refresh(false);
  };

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4" aria-labelledby="database-admin-title">
      <div>
        <h2 id="database-admin-title" className="text-lg font-semibold">Database backups and reset</h2>
        <p className="mt-1 text-sm text-slate-400">
          Backups are stored on the server’s mounted backup storage volume. An optional extra copy downloads to this device.
        </p>
      </div>
      {catalog && <p className="text-xs text-slate-400">
        Default server folder: {catalog.backupRoot}{catalog.selectedDirectory ? `/${catalog.selectedDirectory}` : ''}
        {' · '}{catalog.backups.length} backup(s) in this folder
      </p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!catalog || loading} onClick={() => setOperation('backup')}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          <Archive size={14} /> Create backup
        </button>
        <button type="button" disabled={!catalog || loading} onClick={() => setOperation('restore')}
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-sm disabled:opacity-50">
          <RotateCcw size={14} /> Restore backup
        </button>
        <button type="button" disabled={loading} onClick={() => setChoosingLocation(true)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-sm disabled:opacity-50">
          <FolderCog size={14} /> Backup folder
        </button>
        <button type="button" disabled={!catalog || loading} onClick={() => setOperation('wipe')}
          className="inline-flex items-center gap-1 rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-300 disabled:opacity-50">
          <Trash2 size={14} /> Wipe guild data
        </button>
        <button type="button" disabled={loading} onClick={() => void refresh()}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm disabled:opacity-50">
          {loading ? 'Loading…' : 'Refresh backups'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!error && notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
      {catalog && !loading && !error && !notice && <p role="status" className="text-sm text-slate-500">
        Backup list is up to date.
      </p>}
      {!catalog && !error && <p role="status" className="text-sm text-slate-500">Loading backup directory…</p>}
      {catalog && operation && <DatabaseOperationDialog operation={operation} catalog={catalog}
        onClose={() => setOperation(null)} onComplete={complete} />}
      {choosingLocation && <BackupLocationDialog initial={catalog}
        onClose={() => setChoosingLocation(false)} onSaved={(updated) => {
          setCatalog(updated);
          setError(null);
          setNotice(`Default backup folder set to ${updated.backupRoot}/${updated.selectedDirectory}`);
        }} />}
    </section>
  );
};
