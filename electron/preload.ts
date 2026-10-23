import { contextBridge } from 'electron';

// The page leaves room for the macOS traffic lights (the window has no title bar there)
contextBridge.exposeInMainWorld('__PLATFORM__', process.platform);

// In dev mode, Vite's proxy handles /api so no injection needed.
// In prod, inject the embedded server's base URL before React code runs.
if (process.env.ELECTRON_DEV !== 'true') {
  const port = process.env.EXPRESS_PORT ?? '58342';
  contextBridge.exposeInMainWorld('__API_BASE__', `http://localhost:${port}/api`);
}
