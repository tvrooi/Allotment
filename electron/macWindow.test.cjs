const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  hasMacWindowMarker,
  withMacWindowAgent,
  serverDrawsMacWindow,
  MAC_WINDOW_AGENT,
} = require('./dist/macWindow.js');

const page = (head) =>
  `<!doctype html><html><head><title>Allotment</title>${head}</head><body><div id="root"></div></body></html>`;
const respond =
  (body, init = {}) =>
  async () =>
    new Response(body, init);

test('the web client carries the marker and looks for the user agent token', () => {
  const root = path.resolve(__dirname, '..');
  assert.equal(
    hasMacWindowMarker(fs.readFileSync(path.join(root, 'client/index.html'), 'utf8')),
    true,
  );
  assert.ok(
    fs
      .readFileSync(path.join(root, 'client/src/main.tsx'), 'utf8')
      .includes(` ${MAC_WINDOW_AGENT}`),
  );
});

test('only the marker meta counts', () => {
  assert.equal(
    hasMacWindowMarker(page('<meta name="flybudget-mac-window" content="drag-strips" />')),
    true,
  );
  assert.equal(hasMacWindowMarker(page("<meta name='flybudget-mac-window'>")), true);
  assert.equal(
    hasMacWindowMarker(page('<meta name="viewport" content="width=device-width">')),
    false,
  );
  assert.equal(hasMacWindowMarker(page('<meta name="flybudget-mac-window-old">')), false);
  assert.equal(hasMacWindowMarker('flybudget-mac-window'), false);
});

test('the user agent token is added once', () => {
  const agent = withMacWindowAgent('Mozilla/5.0 Chrome/140 Electron/44');
  assert.equal(agent, `Mozilla/5.0 Chrome/140 Electron/44 ${MAC_WINDOW_AGENT}`);
  assert.equal(withMacWindowAgent(agent), agent);
});

test('a server that says so gets a window without a title bar', async () => {
  const html = page('<meta name="flybudget-mac-window" content="drag-strips" />');
  let asked;
  const result = await serverDrawsMacWindow('https://budget.example/', async (url, init) => {
    asked = { url, init };
    return new Response(html);
  });
  assert.equal(result, true);
  assert.equal(asked.url, 'https://budget.example/');
  assert.equal(asked.init.redirect, 'error');
  assert.equal(asked.init.credentials, 'include');
  assert.ok(asked.init.signal instanceof AbortSignal);
});

test('anything less certain keeps the normal title bar', async () => {
  const marked = page('<meta name="flybudget-mac-window">');
  const cases = [
    respond(page('')), // an older server
    respond(marked, { status: 500 }),
    respond(marked, { status: 401 }),
    async () => {
      throw new TypeError('fetch failed'); // unreachable, TLS error or a redirect
    },
    // Too slow: the window opens with the normal title bar instead of waiting
    (_url, init) =>
      new Promise((_resolve, reject) =>
        init.signal.addEventListener('abort', () => reject(init.signal.reason)),
      ),
  ];
  for (const request of cases)
    assert.equal(await serverDrawsMacWindow('https://budget.example/', request, 50), false);
});

test('reading stops at the body, so a huge page is not downloaded', async () => {
  let pulls = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new TextEncoder().encode(pulls === 1 ? page('') : 'x'.repeat(65536)));
      if (pulls > 1000) controller.close();
    },
  });
  assert.equal(await serverDrawsMacWindow('https://budget.example/', respond(body)), false);
  assert.ok(pulls < 3);
});

test('every module the main process loads is packaged', () => {
  const root = path.resolve(__dirname, '..');
  const { files } = JSON.parse(fs.readFileSync(path.join(root, 'electron-builder.json'), 'utf8'));
  const seen = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const source = fs.readFileSync(path.join(__dirname, `${name}.ts`), 'utf8');
    for (const [, local] of source.matchAll(/from '\.\/([\w-]+)'/g)) visit(local);
  };
  visit('main');
  for (const name of seen) assert.ok(files.includes(`electron/dist/${name}.js`), `${name}.js`);
});
