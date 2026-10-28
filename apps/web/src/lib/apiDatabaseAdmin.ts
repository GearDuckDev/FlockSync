import {
  BackupCatalogSchema,
  DatabaseAdminResultSchema,
  type Backup,
  type BackupCatalog,
  type DatabaseAdminResult
} from '@flocksync/shared-types';
import { request, requestBlob } from './api';

export const fetchDatabaseBackupCatalog = async (
  token: string,
  directory?: string,
): Promise<BackupCatalog> => {
  const query = directory === undefined ? '' : `?directory=${encodeURIComponent(directory)}`;
  return BackupCatalogSchema.parse(await request(`/admin/database${query}`, {}, token));
};

export const saveBackupDirectory = async (token: string, relativeDirectory: string): Promise<BackupCatalog> =>
  BackupCatalogSchema.parse(await request('/admin/database/location', {
    method: 'PUT', body: JSON.stringify({ relativeDirectory }),
  }, token));

export const createBackupDirectory = async (token: string, relativeDirectory: string): Promise<BackupCatalog> =>
  BackupCatalogSchema.parse(await request('/admin/database/directories', {
    method: 'POST', body: JSON.stringify({ relativeDirectory }),
  }, token));

export const createDatabaseBackup = async (token: string): Promise<DatabaseAdminResult> =>
  DatabaseAdminResultSchema.parse(await request('/admin/database/backup', { method: 'POST' }, token));

export const restoreDatabaseBackup = async (
  token: string,
  backup?: Pick<Backup, 'filename' | 'relativeDirectory'>,
): Promise<DatabaseAdminResult> =>
  DatabaseAdminResultSchema.parse(await request('/admin/database/restore', {
    method: 'POST', body: JSON.stringify(backup ?? {}),
  }, token));

export const uploadDatabaseBackup = async (token: string, file: File): Promise<DatabaseAdminResult> =>
  DatabaseAdminResultSchema.parse(await request('/admin/database/restore-upload', {
    method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: file,
  }, token));

export const wipeDatabase = async (token: string): Promise<DatabaseAdminResult> =>
  DatabaseAdminResultSchema.parse(await request('/admin/database/wipe', { method: 'POST' }, token));

export const downloadDatabaseBackup = async (token: string, backup: Backup): Promise<void> => {
  const query = new URLSearchParams({ directory: backup.relativeDirectory });
  const path = `/admin/database/backups/${encodeURIComponent(backup.filename)}/download?${query}`;
  const blob = await requestBlob(path, token);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backup.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
