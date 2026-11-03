# Use the desktop app with Home Assistant storage

The Allotment desktop app can connect to the Allotment server on Home Assistant. For a full
walk-through from scratch, see [Start here](docs/START-HERE.md). Budgeting happens in its own desktop window. Home Assistant runs the database,
password login and Up API connection in the background; you do not need to use its dashboard
to manage your budget.

## Connect

1. Install and start the app in Home Assistant, following [Start here](docs/START-HERE.md#track-a-home-assistant).
2. Open the desktop app. On a new installation it asks **Where is your budget?**
   On an existing installation, choose **Budget → Budget location…** in the desktop menu.
3. Enter the Allotment address, for example `http://homeassistant.local:3001`.
   Use the standalone Allotment address on port 3001, rather than Home Assistant's port 8123.
4. For HTTP on your trusted home network or VPN, tick **I trust this home network or VPN**. Prefer HTTPS,
   particularly for access away from home. The app does not bypass certificate checks.
5. Choose **Connect to server**. The app saves the address and restarts.
6. Sign in with your Allotment password. If this is the first connection, enter the setup code
   from the Home Assistant app's Log tab and create that password in the desktop window.
7. Connect Up in **Settings → Connected Banks**. The token is kept on the Home Assistant server.

The app remembers the server and its login session between launches (sessions can expire or be
revoked). Other devices use the same server: another desktop, or its URL in a browser
on your phone/tablet. Allotment uses one owner password for this budget.

## What runs where

- **Desktop:** Allotment's own window, using the interface served by your Allotment server.
  Remote pages run in a sandbox without Node access or the local desktop API bridge.
- **Home Assistant:** the Allotment service, authoritative SQLite database, encrypted bank token
  and Up sync. It stays available when the desktop app is closed.
- **Up:** contacted by the server. Sync runs on server startup and when you choose **Sync Now**, plus
  opt-in background polling. Opening the desktop app does not restart this server.

Server mode does not start the desktop's embedded server, open its local database, or copy that
database onto Home Assistant. **Use this computer** opens a separate local budget. Switching
locations does not migrate or merge data. Back up an existing budget before planning a migration;
Up can link an account that already has history only from a cut-over date you choose.

Each server address has a separate desktop browser profile, keeping its login and optional
offline copy apart from other budgets. Changing from a LAN address to a VPN/HTTPS address may
therefore require signing in again. In server mode, the existing **Settings → Server** offline-copy
setting applies; this is not full offline synchronization. Keep the server reachable while working.

Away from home, connect your computer to your VPN/Tailscale network and use the reachable server
address. Home Assistant Cloud does not automatically forward Allotment's independent port.
If the server cannot be reached, the desktop shows the connection picker so you can retry or
change its address. The **Budget** menu remains available.

Download the desktop app from this fork's [Releases](https://github.com/tvrooi/Allotment/releases),
not from the original FlyBudget project, which cannot connect to a server like this. The Mac app is
ad-hoc signed and is not Apple-notarised; [Start here](docs/START-HERE.md#track-b-desktop-only) shows
how to open it.

## Desktop program updates

Server screens update through **Budget → Reload**. **Budget → Check for desktop updates…**
offers installer downloads without Apple membership. Verified signed Mac builds additionally
offer Download and Restart. The first updater-enabled build needs one manual install;
see [Desktop updates](docs/DESKTOP-UPDATES.md).
