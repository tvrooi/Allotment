# Allotment with Up on Home Assistant

This app runs your Allotment budget on Home Assistant, with direct Up Bank imports. It is a
prebuilt app for 64-bit Intel/AMD and ARM, so nothing is compiled on your device. It has its own
Allotment password, separate from your Home Assistant login. For the full beginner walk-through,
including the desktop app and making an Up token, see
[Start here](https://github.com/tvrooi/Allotment/blob/main/docs/START-HERE.md).

## 1. Install and start

1. Open **Settings → Apps → Install app**. Select the three dots (⋮) at the top right, then
   **Repositories**. Add `https://github.com/tvrooi/home-assistant-apps`, then **Close**. If you
   cannot see these menus, turn on **Advanced mode** on your user profile.
2. Find **Allotment** and select **Install**.
3. Turn on **Start on boot** and **Watchdog**, then select **Start**.
4. Open the app's **Log** tab and copy the one-time Allotment setup code.
5. Select **Open web UI**, or connect the desktop app to `http://homeassistant.local:3001` (use
   port 3001, not 8123; if that name does not work, use the address in **Settings → System →
   Network**). For HTTP on a trusted home network, tick **I trust this home network or VPN**.
6. Enter the setup code and create your Allotment password. Use the same password from each device.
   This is one budget with one owner password, unless you turn on separate budgets (below).

If you forget the password, choose **Forgot password?** on the sign-in screen. Allotment makes a
one-time reset code (it works once, for 24 hours) and shows it in Home Assistant under
**Notifications** and in the app's **Log** tab. Enter it with a new password; every other device
is signed out.

Keep protection mode enabled. The app asks for Home Assistant API access only to send password
codes as notifications; it never reads your entities. It doesn't need Docker socket access, host
networking or elevated Linux capabilities. Its startup script prepares only its private data
directory, then starts Allotment as the unprivileged Node user.

## 2. Connect Up

In Allotment, choose **Connect Up** on the welcome screen, or open **Settings → Connected Banks →
Up → Connect Up**. Create a personal access token at [Up's developer portal](https://api.up.com.au/)
and paste it directly into Allotment. For each Up account choose **Create a new account**, or link
an AUD account you already have (one with history links from a cut-over date), then **Save & Sync**.
Your other devices use that server connection; you do not enter a token on each device.

Up sync runs on app startup or **Sync Now**. In Settings → Connected Banks → Up, opt in to
background sync every 15, 30, 60 or 240 minutes; failures delay retries. It defaults off. Opening a
browser does not restart the server. Only settled transactions are imported. Review internal
transfers and Round Ups in the register.

This is a new server installation. A desktop budget on your computer does not move here
automatically. To start fresh, connect Up directly in this server. If you want to keep an existing
budget, export a JSON backup under **Settings → Data** first, or import it with **Import from
YNAB** or **Import CSV**.

## 3. Use it from other devices

The Allotment desktop app can use this server directly. Open **Budget → Budget location…**,
enter the Allotment address (for example `http://homeassistant.local:3001`), tick the HTTP
confirmation if appropriate for your trusted home network, and choose **Connect to server**.
After it restarts, sign in with the Allotment password. New desktop installations show this
choice on first launch (**Where is your budget?**). See
[Use the desktop app with Home Assistant storage](https://github.com/tvrooi/Allotment/blob/main/DESKTOP-SERVER.md).

On a phone, tablet or another laptop, open the same Allotment address in a browser and sign in.
You can bookmark it or add it to your phone's home screen. All these devices read and save the
same server database. Choosing **Use this computer** in the desktop app opens a separate local
budget; changing locations does not migrate or merge an existing budget.

## Reach it away from home

HTTP is fine on a trusted home network but is not encrypted, so do not expose port 3001 to the
internet, and do not use router port forwarding or Funnel for this. Home Assistant Cloud (Nabu
Casa) does not forward Allotment's port, and this app does not use HA Ingress.

To reach it from outside your home, use **Tailscale**, either through the Home Assistant community app or
an existing VPN/router. Connect your devices to the same private network and expose Allotment
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

In Allotment's Home Assistant app Configuration tab, set `trust_proxy: true` when the app is
behind that single HTTPS reverse proxy. This lets Allotment mark its login cookies Secure.
Optionally set `allowed_hosts` to your service hostname and any LAN hostname/IP you also use,
separated by commas. Leave `trust_proxy: false` for a direct connection without a proxy.

If you already have a Tailscale subnet router, you can instead reach the LAN URL over your VPN
using its existing routing; no additional Tailscale service is needed.

## Separate budgets for more than one person

Turn on **multi_user** in the app's **Configuration** tab and restart the app to give each person
a budget only they can open, each with their own password.

- **Your existing budget stays where it is.** The first person to sign in after turning it on
  becomes the administrator, and the budget that was already here becomes theirs. Enter your
  name, the setup code from the app's **Log**, and a password. Nothing is moved or rewritten:
  turning **multi_user** off again goes back to that budget and its old password.
- **Adding someone:** **Settings → Server → People → Add person** creates an empty budget for
  them and shows an invitation code. Give them the code; on the sign-in page they choose
  **I have an invitation**, enter their name and the code, and choose their password.
- **Nobody sees anyone else's budget** through Allotment: each budget runs as its own process with
  its own database and encryption key, and every request goes to the signed-in person's budget
  only. The administrator can add people, stop someone signing in, or issue a reset code, but
  can't open their budget. Whoever administers Home Assistant can still read the app's files
  and backups, as for any app.
- **Sharing household costs:** two people can combine a household each keeps in their own
  budget (**Household → Combine with another Allotment user**). Both then see both households'
  entries, splits and merchants, and one note on each entry that either can edit, but nothing
  else from the other's budget. Either can stop combining at any time.
- **Forgotten passwords:** each person can choose a phone in **Settings → Server → Password codes
  to your phone** (a notify service such as `notify.mobile_app_my_phone`). **Forgot password?**
  then sends a code there through the Home Assistant Companion app (six digits, for 10
  minutes). The administrator's code, valid for 24 hours, is also written to the app's **Log**. For anyone else, the administrator
  chooses **Reset password**, and the code appears in the **Log** for them to pass on.
- **Read-only access tokens** and the assistant (MCP) connection work per person: each token
  reaches only the budget that created it.
- **Bank connections** (Enable Banking) work per person: the bank sends you back to the budget
  that started the login.
- **Memory:** each budget uses roughly 100 to 150 MB while the app runs.
- **Backups** of the app include every person's budget, keys and `people.db`. Restore the whole
  app; restoring one person's budget on its own isn't offered.

## Storage, backups and updates

- The database and credential encryption key live in the app's private `/data/flybudget` folder.
  This folder persists through app restarts and normal updates.
- Include **Allotment** in Home Assistant backups. It uses a cold backup: Home
  Assistant briefly stops it so the SQLite database and encryption key are copied consistently.
  Home Assistant backups include the key, so protect those backups.
- You can also export a portable JSON backup in Allotment. Those exports exclude bank tokens
  and do not replace the full Home Assistant backup.
- Uninstalling the app can remove its data. Export or back up before uninstalling.
- Updates arrive through the repository like any other app. Select **Update** when Home Assistant
  offers it, or turn on **Auto update**. Take a backup first if you want a safety net.

## Incorrect setup code

The setup code lives in memory and changes on every server restart. Copy the last code printed
after the most recent startup, rather than a code from an earlier log block. Spaces, dashes and
letter case are ignored. A completed password setup invalidates the code. If the app keeps
restarting, check the **Log** tab for the cause before trying again.

## Advanced: manual install

Most people should use the repository above. Use this route only if you cannot add the repository,
for example when testing your own build. The app then has a different ID (`local_flybudget_up`) and
a separate, empty data folder from the repository app. Adding the repository later does not
migrate it; moving a budget between the two needs a verified cold backup that includes the
encryption key. Keep the working app until you have checked the new one.

1. Package the app from the source with `python3 homeassistant/package.py --out <folder>`. It
   produces a `flybudget_up` folder.
2. In Home Assistant, install and start the **Samba share** app if you do not already have access
   to the local apps folder. Its login is the one you configure in Samba, not your HA login.
3. On a Mac, use **Finder → Go → Connect to Server** and enter `smb://homeassistant.local` (or your
   Home Assistant machine's address on your network).
4. Open the `local_apps` share (called `addons` on older installations) and copy the
   `flybudget_up` folder into it, so that `local_apps/flybudget_up/config.yaml` exists with the
   Dockerfile beside it. Do not copy it into Home Assistant's `config` folder.
5. In **Settings → Apps → Install app**, use the top-right menu to reload the store. Find
   **Allotment** under **Local apps** and select **Install**. This compiles the app on
   your device, which can take several minutes on a Raspberry Pi.
6. Continue from step 3 of "Install and start" above.

A local app has no update feed. To update it, replace the folder with a newer package and use
**Rebuild**, keeping the slug `flybudget_up` so the same data is kept.

## Official references

- [Home Assistant apps and local builds](https://contributors.home-assistant.io/apps/how-apps-work/)
- [App configuration and persistent storage](https://contributors.home-assistant.io/apps/reference/configuration/)
- [Samba share and file access](https://www.home-assistant.io/common-tasks/os/)
- [Tailscale community app](https://github.com/hassio-addons/app-tailscale/blob/main/tailscale/DOCS.md)
