/// <reference types="vite/client" />

interface Window {
  __API_BASE__?: string;
  /** The desktop app's `process.platform` (set by its preload) */
  __PLATFORM__?: string;
}
