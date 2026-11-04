import { Router } from 'express';
import { rmSync } from 'node:fs';
import {
  BackupArchiveError,
  InvalidBackupError,
  archiveUploadPath,
  receiveArchive,
  restoreBackupArchive,
  writeBackupArchive,
} from '../services/backupArchive.js';

// A backup with files (services/backupArchive.ts): Settings → Data. Mounted in index.ts only: it
// reads and writes files on disk, which the in-browser demo can't, and like every backup route it
// is behind the login and never reachable with an access token (auth/accessTokens.ts).
export const backupArchiveRouter = Router();

backupArchiveRouter.get('/', async (_req, res) => {
  try {
    await writeBackupArchive(res);
  } catch (e) {
    if (e instanceof BackupArchiveError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

// The ZIP is the request body itself (Content-Type application/zip), saved to disk as it arrives
backupArchiveRouter.post('/restore', async (req, res) => {
  const type = (req.headers['content-type'] ?? '').split(';')[0].trim();
  if (type !== 'application/zip' && type !== 'application/octet-stream')
    return res.status(415).json({ error: 'Send the backup ZIP as application/zip' });
  const file = archiveUploadPath();
  try {
    await receiveArchive(req, file);
    res.json(await restoreBackupArchive(file));
  } catch (e) {
    if (e instanceof BackupArchiveError) return res.status(e.status).json({ error: e.message });
    if (e instanceof InvalidBackupError) return res.status(400).json({ error: e.message });
    // e.g. a row pointing at an account that isn't in the file: nothing was changed
    console.error('Restore with files failed:', e);
    res.status(400).json({ error: 'The backup is inconsistent, so nothing was restored' });
  } finally {
    rmSync(file, { force: true });
  }
});
