/** Where the Files page's next page starts, or undefined once every file is loaded */
export function nextFilesOffset(pages: { documents: unknown[] }[], total: number) {
  const loaded = pages.reduce((n, p) => n + p.documents.length, 0);
  return loaded < total ? loaded : undefined;
}
