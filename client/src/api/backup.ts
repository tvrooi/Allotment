import { apiFetch } from './client';

export interface RestoreResult {
  /** Rows restored per table */
  restored: Record<string, number>;
  /** File name of the copy of the database saved before restoring (next to the database) */
  safetyCopy: string | null;
}

/** Replaces all data with a backup file's contents (the parsed JSON). */
export const restoreBackup = (backup: unknown) =>
  apiFetch<RestoreResult>('/export/restore', { method: 'POST', body: JSON.stringify(backup) });

export interface ArchiveRestoreResult extends RestoreResult {
  /** Files the ZIP added, ones this installation already had, and ones neither has */
  files: { added: number; alreadyHere: number; missing: number };
}

/**
 * Replaces all data with a backup with files (the ZIP itself, sent as is). Every file is checked
 * before anything changes (server/src/services/backupArchive.ts).
 */
export const restoreBackupArchive = (archive: Blob) =>
  apiFetch<ArchiveRestoreResult>('/backup-archive/restore', {
    method: 'POST',
    body: archive,
    headers: { 'Content-Type': 'application/zip' },
  });
