// macOS windows without a title bar. The local budget's page learns it's in one through the
// preload; a server's page has no preload, so a server window drops the title bar only when
// the server's web client says it can draw the Mac layout (drag strips, room for the window
// buttons). An older server would leave the buttons over its sidebar and nothing to drag the
// window by, so anything short of that marker keeps the normal title bar.

/** `<meta name=…>` in the web client's index.html (client/index.html) */
export const MAC_WINDOW_META = 'flybudget-mac-window';
/** Added to a server window's user agent; client/src/main.tsx looks for it */
export const MAC_WINDOW_AGENT = 'FlyBudgetMacWindow/1';

/** Only the start of the page is read: the marker sits in its <head> */
const MAX_HTML_BYTES = 256 * 1024;

export function hasMacWindowMarker(html: string): boolean {
  return new RegExp(`<meta\\s+name=["']?${MAC_WINDOW_META}["'\\s>/]`, 'i').test(html);
}

export function withMacWindowAgent(userAgent: string): string {
  return userAgent.includes(MAC_WINDOW_AGENT) ? userAgent : `${userAgent} ${MAC_WINDOW_AGENT}`;
}

/**
 * Whether the server's page can be shown without a title bar. False whenever that isn't
 * certain: unreachable, slow, an error, a redirect (e.g. a sign-in proxy) or an older client.
 * `request` is the window's own session fetch, so it uses that session's certificates and
 * cookies and never bypasses a TLS error.
 */
export async function serverDrawsMacWindow(
  url: string,
  request: (url: string, init: RequestInit) => Promise<Response>,
  timeoutMs = 4000,
): Promise<boolean> {
  try {
    const response = await request(url, {
      headers: { Accept: 'text/html' },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok || !response.body) return false;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    try {
      while (html.length < MAX_HTML_BYTES) {
        const chunk = await reader.read();
        if (chunk.done) break;
        html += decoder.decode(chunk.value, { stream: true });
        if (hasMacWindowMarker(html)) return true;
        // The marker is in the <head>: past it, there's nothing more to find
        if (/<body[\s>]/i.test(html)) return false;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return hasMacWindowMarker(html);
  } catch {
    return false;
  }
}
