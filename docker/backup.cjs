// Safe copy of the database while Allotment is running (SQLite online backup, so
// changes still in the write-ahead log are included), and of the files kept beside it
// (videos in Files: <budget>-files/, see server/src/services/fileStore.ts). Those are named
// by their content and never change, so copying them while Allotment runs is safe.
//   docker exec flybudget node backup.cjs
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH;
const dir = path.join(path.dirname(dbPath), 'backups');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = path.join(dir, `budget-${stamp}.db`);

fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const filesDir =
  process.env.FLYBUDGET_FILES_DIR ??
  path.join(path.dirname(dbPath), `${path.basename(dbPath).replace(/\.db$/i, '')}-files`);
db.backup(file)
  .then(() => {
    console.log(`Backup saved to ${file}`);
    if (fs.existsSync(filesDir)) {
      const copy = path.join(dir, `budget-${stamp}-files`);
      // Files still arriving (incoming/) are not part of the budget yet
      fs.cpSync(filesDir, copy, {
        recursive: true,
        filter: (src) => path.basename(src) !== 'incoming',
      });
      console.log(`Files kept beside the database copied to ${copy}`);
    }
  })
  .finally(() => db.close());
