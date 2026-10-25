/** A Content-Disposition header for any file name: an ASCII fallback plus the exact UTF-8 name */
export function disposition(inline: boolean, fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
