# Use the desktop app with Home Assistant storage

The updated **FlyBudget Up Preview** desktop app can connect to the FlyBudget server on
Home Assistant. Budgeting happens in its own desktop window. Home Assistant runs the database,
password login and Up API connection in the background; you do not need to use its dashboard
to manage your budget.

## Connect

1. Install and start the Home Assistant package using `homeassistant/DOCS.md`.
2. Open the updated desktop preview. On a new installation it asks **Where is your budget?**
   On an existing installation, choose **Budget → Budget location…** in the desktop menu.
3. Enter the FlyBudget address, for example `http://homeassistant.local:3001`.
   Use the standalone FlyBudget address on port 3001, rather than Home Assistant's port 8123.
4. For HTTP on your trusted home network or VPN, select the HTTP confirmation. Prefer HTTPS,
   particularly for access away from home. The app does not bypass certificate checks.
5. Choose **Connect to server**. The app saves the address and restarts.
6. Sign in with your FlyBudget password. If this is the first connection, enter the setup code
   from the Home Assistant app's Log tab and create that password in the desktop window.
7. Connect Up in **Settings → Connected Banks**. The token is kept on the Home Assistant server.

The app remembers the server and its login session between launches (sessions can expire or be
revoked). Other devices use the same server: another desktop preview, or its URL in a browser
on your phone/tablet. FlyBudget uses one owner password for this budget.

## What runs where

- **Desktop:** FlyBudget's own window, using the interface served by your FlyBudget server.
  Remote pages run in a sandbox without Node access or the local desktop API bridge.
- **Home Assistant:** the FlyBudget service, authoritative SQLite database, encrypted bank token
  and Up sync. It stays available when the desktop app is closed.
- **Up:** contacted by the server. Sync runs on server startup and when you choose **Sync Now**, plus
  opt-in background polling. Opening the desktop app does not restart this server.

Server mode does not start the desktop's embedded server, open its local database, or copy that
database onto Home Assistant. **Use this computer** opens a separate local budget. Switching
locations does not migrate or merge data. Back up an existing budget before planning a migration;
the Up preview currently refuses to link bank accounts containing pre-existing manual/CSV history.

Each server address has a separate desktop browser profile, keeping its login and optional
offline copy apart from other budgets. Changing from a LAN address to a VPN/HTTPS address may
therefore require signing in again. In server mode, the existing **Settings → Server** offline-copy
setting applies; this is not full offline synchronization. Keep the server reachable while working.

Away from home, connect your computer to your VPN/Tailscale network and use the reachable server
address. Home Assistant Cloud does not automatically forward FlyBudget's independent port.
If the server cannot be reached, the desktop shows the connection picker so you can retry or
change its address. The **Budget** menu remains available.

This capability is in the custom preview, rather than the unmodified upstream desktop release.
The Apple silicon DMG is ad-hoc signed and is not Apple-notarized.

## Developer checks

```sh
npm run compile:electron
node --test electron/connection.test.cjs
npm run build:server:bundle
npm run build --prefix client -- --outDir /tmp/flybudget-web
node electron/remote-smoke.cjs /tmp/flybudget-web
```

The smoke test uses real Electron and an isolated local server, with a throwaway database/profile.
It checks the native picker, HTTP confirmation, login/setup, server writes visible to another
signed-in device, session persistence, and that no local database or credential key was created.
It does not use real Up credentials.

## Desktop program updates

Server screens update through **Budget → Reload**. **Budget → Check for desktop updates…**
offers installer downloads without Apple membership. Verified signed Mac builds additionally
offer Download and Restart. The first updater-enabled build needs one manual install;
see [Desktop updates](docs/DESKTOP-UPDATES.md).
