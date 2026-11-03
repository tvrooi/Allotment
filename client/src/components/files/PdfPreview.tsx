import { useEffect, useRef, useState } from 'react';
import { fileUrl } from '../../api/files';

/** Pages drawn at most; a longer PDF is downloaded to read the rest */
const MAX_PAGES = 20;

/**
 * A PDF drawn page by page onto canvases by PDF.js, so it never opens as a document in the app's
 * own origin: no scripts, forms or links in it run (docs/FILES.md §3). PDF.js loads only when a
 * PDF is opened.
 */
export function PdfPreview({ id, fileName }: { id: string; fileName: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'done'; pages: number } | { status: 'failed' }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    const target = box.current;
    (async () => {
      try {
        const [pdfjs, worker] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const res = await fetch(fileUrl(id), { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = new Uint8Array(await res.arrayBuffer());
        const task = pdfjs.getDocument({ data, enableXfa: false, stopAtErrors: false });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        if (cancelled || !target) return;
        target.replaceChildren();
        const width = Math.max(240, target.clientWidth || 600);
        const ratio = window.devicePixelRatio || 1;
        for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const viewport = page.getViewport({
            scale: width / page.getViewport({ scale: 1 }).width,
          });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width * ratio);
          canvas.height = Math.floor(viewport.height * ratio);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.className = 'block mx-auto mb-3 rounded border border-border-light bg-white';
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `${fileName}, page ${n} of ${doc.numPages}`);
          target.appendChild(canvas);
          await page.render({
            canvas,
            canvasContext: canvas.getContext('2d')!,
            viewport,
            transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
          }).promise;
        }
        if (!cancelled) setState({ status: 'done', pages: doc.numPages });
      } catch {
        if (!cancelled) setState({ status: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [id, fileName]);

  return (
    <div>
      {state.status === 'loading' && (
        <div className="h-64 bg-surface-alt rounded animate-pulse" aria-label="Loading the PDF" />
      )}
      {state.status === 'failed' && (
        <p className="text-sm text-text-tertiary">
          This PDF can't be shown here. Download it to open it.
        </p>
      )}
      <div ref={box} className="max-h-[70vh] overflow-y-auto" />
      {state.status === 'done' && state.pages > MAX_PAGES && (
        <p className="text-xs text-text-tertiary mt-1">
          Showing the first {MAX_PAGES} of {state.pages} pages. Download it to read the rest.
        </p>
      )}
    </div>
  );
}
