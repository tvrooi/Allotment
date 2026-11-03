// Keeping Files' rows consistent when other records change. No Node modules here: the categories
// routes and backups, which the in-browser demo also runs, use these.
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { documentLinks, documents, receipts } from '../db/schema.js';

/**
 * Give every receipt its document in Files: receipts restored from a backup made before Files
 * (format 22 and older) have none. Returns how many were added.
 */
export function ensureReceiptDocuments() {
  const missing = db
    .select()
    .from(receipts)
    .where(
      sql`${receipts.documentId} IS NULL OR NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = ${receipts.documentId})`,
    )
    .all();
  if (!missing.length) return 0;
  db.transaction((tx) => {
    for (const r of missing) {
      const taken = tx
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.id, r.id))
        .get();
      const documentId = taken ? nanoid() : r.id;
      tx.insert(documents)
        .values({
          id: documentId,
          fileId: r.fileId,
          fileName: r.fileName,
          mimeType: r.mimeType,
          size: r.size,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })
        .run();
      tx.update(receipts).set({ documentId }).where(eq(receipts.id, r.id)).run();
    }
  });
  return missing.length;
}

/** When categories merge, the merged one's files go to the category it was merged into */
export function moveCategoryLinks(from: string, to: string) {
  db.run(sql`UPDATE OR IGNORE document_links SET category_id = ${to} WHERE category_id = ${from}`);
  db.delete(documentLinks).where(eq(documentLinks.categoryId, from)).run();
}
