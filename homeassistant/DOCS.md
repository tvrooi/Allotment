# Install FlyBudget with Up on Home Assistant OS

This package contains the modified FlyBudget source, a Dockerfile and a Home Assistant app
configuration. It builds on your Home Assistant machine; no separate Docker installation,
Docker management app, Node-RED or Up subscription is required.

## 1. Copy the app to Home Assistant

1. Download `FlyBudget-Up-Home-Assistant.zip` and unzip it on your computer.
2. In Home Assistant, install and start the **Samba share** app if you do not already have access
   to the local apps folder. Its login is the one you configure in Samba, not your HA login.
3. On a Mac, use **Finder → Go → Connect to Server** and enter `smb://homeassistant.local`.
   If that name does not resolve, use your Home Assistant machine's LAN IP instead.
4. Open the `local_apps` share (called `addons` on older installations), and copy the extracted
   `flybudget_up` folder into it. The result must be `local_apps/flybudget_up/config.yaml`
   (or `addons/flybudget_up/config.yaml`), with the Dockerfile beside it. Do not copy it into
   Home Assistant's `config` folder, and do not add an extra ZIP wrapper folder.

If you use Terminal & SSH, check whether the local folder is exposed as `/local_apps` or `/addons`.
These are app container paths, not the host filesystem. The app ID is `local_flybudget_up`.

## 2. Install and start

1. Open **Settings → Apps → Install app** (older versions: **Settings → Add-ons → Add-on Store**).
2. Use the top-right menu to **Check for updates / Reload** the store. If the local section is
   missing, enable **Advanced mode** in your Home Assistant user profile and refresh the page.
3. Find **FlyBudget Up Preview** under **Local apps / Local add-ons**, and choose **Install**.
   The first installation compiles the app and downloads its dependencies. Allow it to finish;
   this can take several minutes, particularly on a Raspberry Pi. Home Assistant needs an
   internet connection and enough free space and memory for a source build.
4. Enable **Start on boot** and **Watchdog**, then choose **Start**.
5. Open the app's **Log** tab. Copy its one-time FlyBudget setup code.
6. In the updated desktop preview, choose **Budget → Budget location…** and connect to
   `http://homeassistant.local:3001` (or `http://<home-assistant-LAN-IP>:3001`). For HTTP on a
   trusted home network, select its confirmation. Alternatively, choose **Open Web UI**.
7. Enter the setup code and create your FlyBudget password. Use this same password from each
   device. This is one budget with one owner password, rather than separate user accounts.

Keep protection mode enabled. This app does not require Home Assistant/Supervisor API access,
Docker socket access, host networking or elevated Linux capabilities. Its startup script prepares
only its private data directory, then starts FlyBudget as the unprivileged Node user.

## 3. Connect Up

In FlyBudget, open **Settings → Connected Banks → Up → Connect Up**. Create a personal access
token at [Up's developer portal](https://api.up.com.au/) and paste it directly into FlyBudget.
Choose new accounts or empty AUD accounts and **Save & Sync**. Your other devices use that
server connection; you do not enter a separate token on each device.

Up sync runs on app startup or **Sync Now**. In Settings → Connected Banks → Up, opt in to
background sync every 15, 30, 60 or 240 minutes; failures delay retries. It defaults off. With a server
that stays running, opening a browser does not restart the server; use **Sync Now** or enable background sync for updates.
Only settled transactions are imported. Review internal transfers and Round Ups in the register.

This is a new server installation. The Mac preview's local budget does not automatically move
here. If you already have data there, export a JSON backup under **Settings → Data** before moving
it. The preview deliberately refuses linking accounts with existing history, so a populated
desktop budget needs a separate migration step to preserve account links without double imports.
For a new budget, connect Up directly in this server and use it from your desktop or other devices.

## 4. Use it from other devices

The updated **FlyBudget Up Preview** desktop app can use this server directly. Open
**Budget → Budget location…**, enter the FlyBudget address (for example
`http://homeassistant.local:3001`), confirm HTTP if appropriate for your trusted home network,
and choose **Connect to server**. After it restarts, sign in with the FlyBudget password.
New desktop installations show this choice on first launch. See `DESKTOP-SERVER.md` in the source
package for details. Budgeting stays in the desktop window; Home Assistant hosts the service.

On a phone, tablet or another laptop, open the same FlyBudget URL in a browser and sign in.
All these devices read and save the same server database. You can bookmark it or add it to your
phone's home screen. Choosing **Use this computer** in the desktop app opens its separate local
budget; changing locations does not migrate or merge an existing budget.

For access away from home, use **Tailscale**, either through the Home Assistant community app or
an existing VPN/router. Connect your devices to the same private network and expose FlyBudget
there, preferably with HTTPS. A direct web port does not automatically become available through
Home Assistant Cloud/Nabu Casa. This package opens its own web UI; it does not implement HA Ingress.

With the Home Assistant community **Tailscale** app, its `services` option can expose other local
apps privately. A configuration to adapt is:

```yaml
services:
  - name: svc:flybudget
    target: http://127.0.0.1:3001
    protocol: https
    port: 443
    path: /
```

This is only the `services` portion: preserve the rest of your Tailscale configuration. Tailscale
Services also needs a tagged host, MagicDNS and HTTPS certificates enabled, a service defined in
the Tailscale admin console, and approval of the Home Assistant machine as its service host.
Follow the [community app's Services documentation](https://github.com/hassio-addons/app-tailscale/blob/main/tailscale/DOCS.md#option-services).
Do not enable Funnel or router port forwarding for this private-access setup.

In FlyBudget's Home Assistant app Configuration tab, set `trust_proxy: true` when the app is
behind that single HTTPS reverse proxy. This lets FlyBudget mark its login cookies Secure.
Optionally set `allowed_hosts` to your service hostname and any LAN hostname/IP you also use,
separated by commas. Leave `trust_proxy: false` for a direct connection without a proxy.

If you already have a Tailscale subnet router, you can instead reach the LAN URL over your VPN
using its existing routing; no additional Tailscale service is needed.

## Storage, backups and updates

- The database and credential encryption key live in the app's private `/data/flybudget` folder.
  This folder persists through app restarts, rebuilds and normal updates.
- Include **FlyBudget Up Preview** in Home Assistant backups. It uses a cold backup: Home
  Assistant briefly stops it so the SQLite database and encryption key are copied consistently.
  Home Assistant backups include the key, so protect those backups.
- You can also export a portable JSON backup in FlyBudget. Those exports exclude bank tokens
  and do not replace the full Home Assistant backup.
- Uninstalling the app can remove its data. Export/back up before uninstalling.
- This is a local app, so there is no published update feed. Replace the source with a newer
  supplied package and use **Rebuild**; keep its slug `flybudget_up` so the same data is retained.

## Repair an options.json permission error

Version `0.2.0-up-ha.1` could fail with
`EACCES: permission denied, open '/data/options.json'` when Supervisor's data directory or options
file was root-only. Version `0.2.0-up-ha.2` fixes this; the current `0.2.0-up-ha.3` includes that
fix and corrects the watchdog. The startup shell opens the configuration
as root and passes a read-only descriptor to the unprivileged launcher. The Supervisor file stays
root-owned and private; only traversal is granted on the parent directory, with the budget/key
folder still private to user 1000.

For an existing installation, use the supplied `FlyBudget-HA-Startup-Fix.py` repair script:

1. Temporarily disable **Watchdog**, and **Stop** FlyBudget.
2. In Studio Code Server, open `/share` and upload the repair script there.
3. Open **Terminal → New Terminal** inside Studio Code Server and run:

   ```sh
   python3 /share/FlyBudget-HA-Startup-Fix.py
   ```

4. Reload/check for updates in the Home Assistant app store, then open FlyBudget and choose
   **Update** to version `0.2.0-up-ha.3` (or **Rebuild** from its menu).
5. **Start** FlyBudget, check its Log, and re-enable **Watchdog** once it is running.

The script validates the existing app source, backs up the four files it changes, and can be
rerun safely. It updates only startup/launcher source, the watchdog and the build version. It does not access
the installed budget or encryption key. From the full source package the same script is named
`homeassistant/repair-permissions.py`; an explicit app source path may be passed as its argument.

## Incorrect setup code

The setup code lives in memory and changes on every server restart. Copy the last code printed
after the most recent startup, rather than a code from an earlier screenshot/log block. Spaces,
dashes and letter case are ignored. A completed password setup invalidates the code.

In ha.1/ha.2 the HTTP watchdog can receive a 403 when `allowed_hosts` only contains the public
hostname: Supervisor sends the container IP as the Host header. This can cause needless restarts
and invalidate a setup code while you are entering it. Temporarily turn **Watchdog off**, restart
FlyBudget once, refresh its Log, copy the newest code, then create the password without restarting
again. Keep Watchdog off until the ha.3 update is installed.

ha.3 uses a TCP watchdog to check the listening port without a Host header. Docker's separate
health check still requests `/api/health` over loopback. The host restrictions on budget/API
requests remain enforced. The updated startup repair script upgrades ha.1 or ha.2 to ha.3.

## Validation

The underlying native Up preview passed 435 server, 206 client and 161 browser tests. Three HA
wrapper tests passed for persistent key handling and server configuration. The Linux ARM64 image
also built and passed a local container test: login required, first-password setup, native Up
endpoint availability, budget/password/key persistence after restart, and the web server running
as user 1000. The permission regression test reproduces the old failure with a root-owned 0700
data directory and a root-owned 0600 options file in a Linux volume, and passes with the fix.
The options file retains its original ownership/permissions and is not directly readable by the
web-server user. A strict-host test also confirms that a container-IP HTTP health request gets
403 while the Supervisor-style TCP check connects successfully. Actual Supervisor installation
and live Up access still need verification on your device.

## Official references

- [Home Assistant apps and local builds](https://contributors.home-assistant.io/apps/how-apps-work/)
- [App configuration and persistent storage](https://contributors.home-assistant.io/apps/reference/configuration/)
- [Samba share and file access](https://www.home-assistant.io/common-tasks/os/)
- [Tailscale community app](https://github.com/hassio-addons/app-tailscale/blob/main/tailscale/DOCS.md)
