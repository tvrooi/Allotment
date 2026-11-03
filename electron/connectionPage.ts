import { randomBytes } from 'crypto';
import type { BudgetLocation } from './connection';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

/** Local-only picker. Its narrowly scoped IPC bridge never enters a server window. */
export function connectionPage(location: BudgetLocation | null, message: string): string {
  const nonce = randomBytes(18).toString('base64');
  const url = location?.mode === 'server' ? location.url : '';
  return (
    'data:text/html;base64,' +
    Buffer.from(
      `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-src 'none'">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Budget location</title>
<style nonce="${nonce}">
:root { color-scheme: light dark; font-family: system-ui, sans-serif; font-size: 15px; }
body { max-width: 520px; margin: 32px auto; padding: 0 24px; }
h1 { font-size: 25px; margin-bottom: 12px; } p { line-height: 1.5; }
label { display: block; margin: 16px 0 8px; } input[type=url] { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid #888; border-radius: 6px; font: inherit; }
button { padding: 12px 16px; font: inherit; border-radius: 6px; cursor: pointer; border: 1px solid #888; }
button[type=submit] { background: #2c65d8; color: white; border-color: #2c65d8; margin-top: 8px; }
.check { display: flex; align-items: start; gap: 8px; font-size: 13px; line-height: 1.5; } input[type=checkbox] { margin-top: 3px; }
.muted { font-size: 13px; opacity: .8; } #error { color: light-dark(#a51e1e,#ffadad); min-height: 22px; } hr { margin: 24px 0; opacity: .3; }
</style></head><body>
<h1>Where is your budget?</h1>
<p>Connect to Allotment on your Home Assistant machine. Your budget and Up connection stay on that server.</p>
<form id="server"><label for="url">Allotment server address</label>
<input id="url" type="url" required placeholder="http://homeassistant.local:3001" value="${escapeHtml(url)}" autocomplete="url" spellcheck="false" autofocus>
<label class="check"><input id="http" type="checkbox" ${location?.mode === 'server' && location.allowHttp ? 'checked' : ''}><span>I trust this home network or VPN. Allow HTTP here. HTTP does not encrypt your password or budget; use HTTPS for remote access.</span></label>
<button type="submit">Connect to server</button></form>
<p id="error" role="alert">${escapeHtml(message)}</p>
<p class="muted">The app remembers the address and restarts. Sign in with your Allotment password, separately from Home Assistant.</p>
<hr><button id="local" type="button">Use this computer</button>
<p class="muted">Opens a separate local budget. Changing location does not move or merge budgets.</p>
<script nonce="${nonce}">
const submit = async (value) => {
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => button.disabled = true);
  try {
    const error = await window.budgetLocation.save(value);
    if (error) document.getElementById('error').textContent = error;
  } catch { document.getElementById('error').textContent = 'Could not save the connection. Try again.'; }
  buttons.forEach(button => button.disabled = false);
};
document.getElementById('server').addEventListener('submit', event => {
  event.preventDefault();
  submit({mode:'server',url:document.getElementById('url').value,allowHttp:document.getElementById('http').checked});
});
document.getElementById('local').addEventListener('click', () => submit({mode:'local'}));
</script></body></html>`,
    ).toString('base64')
  );
}
