# Start here

Allotment is a private budgeting app with a direct connection to Up Bank. Pick one of the two ways
to run it, then follow that track from top to bottom. You do not need any other page.

|                  | Home Assistant                                        | Desktop only                          |
| ---------------- | ----------------------------------------------------- | ------------------------------------- |
| Where it lives   | Your budget is stored on your Home Assistant device   | Your budget is stored on one computer |
| Open it from     | Your computer, phone or tablet                        | That computer only                    |
| Good if you want | One budget on every device, syncing in the background | The quickest start, no server         |
| Go to            | [Track A](#track-a-home-assistant)                    | [Track B](#track-b-desktop-only)      |

Words you do not know are explained in the [glossary](GLOSSARY.md).

You will need an Up account (Australia) to import transactions. You can try Allotment without
one: choose **Add accounts manually** on the welcome screen.

<!-- screenshot: the Allotment welcome screen with the "Connect Up" card -->

## Track A: Home Assistant

You need Home Assistant OS or Home Assistant Supervised on a 64-bit device (Intel/AMD or ARM).
Home Assistant Container and Core do not have an app store, so they cannot use this route.
Allow about 15 minutes.

1. **Add the Allotment repository.** In Home Assistant, open **Settings → Apps → Install app**.
   Select the three dots (⋮) at the top right, then **Repositories**. Paste this address, select
   **Add**, then **Close**:

   ```
   https://github.com/tvrooi/home-assistant-apps
   ```

   You can also use the
   [Add to Home Assistant](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Ftvrooi%2Fhome-assistant-apps)
   button. If you cannot see **Apps** or the three dots, turn on **Advanced mode** on your user
   profile page, then reload the page.

   <!-- screenshot: Home Assistant Repositories dialog with the Allotment address pasted in -->

2. **Install the app.** Find **Allotment** in the list (use the search box if needed) and
   select **Install**. This downloads a ready-made app. It can take a few minutes on a Raspberry Pi.

3. **Start it.** On the app's **Info** page, turn on **Start on boot** and **Watchdog**, then
   select **Start**. Leave **Protection mode** on.

4. **Copy the setup code.** Open the app's **Log** tab. Near the end you will see a line with a
   one-time Allotment setup code. Copy it. The code changes every time the app restarts, so always
   copy the newest one. Spaces, dashes and capital letters do not matter.

   <!-- screenshot: the app Log tab with the setup code line highlighted -->

5. **Open Allotment.** Choose one:
   - **In a browser:** on the app's **Info** page select **Open web UI**. Bookmark the page. On a
     phone you can add it to your home screen.
   - **In the desktop app:** download and install it first (follow steps 1 to 3 of
     [Track B](#track-b-desktop-only), then stop at "Where is your budget?"). On that screen enter
     your Home Assistant address followed by `:3001`, for example `http://homeassistant.local:3001`.
     Use **3001**, not Home Assistant's own **8123**. If `homeassistant.local` does not work, use
     the address shown in **Settings → System → Network** instead. Tick **I trust this home network
     or VPN**, then select **Connect to server**. The app restarts.

6. **Create your password.** Enter the setup code and choose an Allotment password. It is separate
   from your Home Assistant login. Use the same password on every device.

7. **Create an Up token.** Follow [Make an Up token](#make-an-up-token) below. It takes about two
   minutes.

8. **Connect Up.** On the welcome screen select **Connect Up**. (Later you can find it under
   **Settings → Connected Banks → Up → Connect Up**.) Paste your token and select **Connect**. For
   each Up account, choose **Create a new account** unless you already have a matching account in
   Allotment, then select **Save & Sync**.

   If you are moving from another budgeting app, read
   [Coming from another app](#coming-from-another-app) first.

9. **Sort your first import.** When the import finishes, Allotment shows **Sort your first import**.
   Up has already supplied categories for many payees. For the rest, pick a category for each
   payee. One choice sorts all of that payee's transactions at once. Select **Skip for now** if you
   would rather do it later: the **Get started** checklist on the dashboard keeps the reminder.
   Allotment also lists any possible transfers between your accounts for you to review. It never
   links them without asking.

   <!-- screenshot: the "Sort your first import" list -->

10. **Set up your payday plan.** Open **Budget → Until next payday → New payday plan**. Name the
    plan, set the **Anchor payday** (any date you were paid) and your **Expected take-home pay**.
    Add the categories you want funded each pay. Select **Preview funding**, check the numbers,
    then **Apply funding** when your pay has arrived. Payday plans are optional. See the
    [payday plans guide](PAYDAY-PLANS.md).

That is all. Allotment imports from Up each time the app starts and when you select **Sync Now**
in **Settings → Connected Banks → Up**. You can also turn on background sync there (every 15, 30,
60 or 240 minutes). It is off until you choose.

**Sharing with a partner or family?** Turn on **multi_user** in the app's **Configuration** tab to
give each person a private budget with their own password. See
[separate budgets for more than one person](../homeassistant/DOCS.md#separate-budgets-for-more-than-one-person).

**Forgot your password?** On the sign-in screen select **Forgot password?**. Allotment makes a
one-time reset code, valid for 24 hours, and shows it in Home Assistant under **Notifications**
and in the app's **Log** tab. Enter it with a new password.

## Track B: Desktop only

This keeps your budget on one computer. You do not need Home Assistant.

1. **Download the right file.** Open the
   [Allotment releases page](https://github.com/tvrooi/Allotment/releases), find the newest
   release, and open its **Assets** list. Pick the file for your computer:

   | Your computer                           | Download                          |
   | --------------------------------------- | --------------------------------- |
   | Mac with an M1, M2, M3 or M4 chip       | `Allotment-macOS-arm64.dmg`       |
   | Mac with an Intel chip                  | `Allotment-macOS-x64.dmg`         |
   | Windows 10 or 11                        | `Allotment-Windows-Setup.exe`     |
   | Ubuntu, Debian, Linux Mint (Intel/AMD)  | `Allotment-Linux-amd64.deb`       |
   | Other Linux (Intel/AMD)                 | `Allotment-Linux-x86_64.AppImage` |
   | Linux on ARM (for example Raspberry Pi) | the `arm64` `.deb` or `.AppImage` |

   Not sure which Mac you have? Choose the Apple menu, then **About This Mac**. It says
   **Chip: Apple M…** or **Processor: Intel…**. Ignore the other files in the list (they are for
   automatic updates and checks).

2. **Install it.**
   - **Mac:** open the `.dmg` and drag **Allotment** into **Applications**.
   - **Windows:** run the `.exe`.
   - **Linux:** open the `.deb` with your software installer. For an AppImage, make it executable
     and run it.

3. **Get past the unsigned-app warning.** Allotment is not signed with a paid Apple or Microsoft
   certificate, so your computer asks whether you trust it. This is expected. You only do it once.
   - **Mac:** open Allotment from Applications. When macOS says it cannot check the app, select
     **Done**. Open **System Settings → Privacy & Security**, scroll to **Security**, and select
     **Open Anyway** next to Allotment. Enter your password. If macOS says the app "is damaged",
     see the [macOS note](#if-macos-says-the-app-is-damaged) below.
   - **Windows:** when you see **Windows protected your PC**, select **More info**, then
     **Run anyway**.

   <!-- screenshot: macOS Privacy & Security with the Open Anyway button -->

4. **Choose where your budget lives.** On the first screen, **Where is your budget?**, select
   **Use this computer**. (Ignore the server address box. That is for Home Assistant.)

5. **Make an Up token** by following [Make an Up token](#make-an-up-token) below.

6. **Connect Up.** On the welcome screen select **Connect Up**, paste the token, then **Connect**.
   For each Up account choose **Create a new account** (or link an existing one, see
   [Coming from another app](#coming-from-another-app)), then select **Save & Sync**.

7. **Sort your first import** and **set up your payday plan** exactly as in steps 9 and 10 of
   [Track A](#track-a-home-assistant).

The desktop app imports from Up when it opens and when you select **Sync Now**. To update the
app, choose **Budget → Check for desktop updates…**. It offers the new installer to download.

You can move to Home Assistant later, but a budget that already has history cannot simply be
copied across while keeping its Up links. If you think you will want Home Assistant, start with
Track A.

### If macOS says the app is "damaged"

This is the same unsigned-app check, shown differently. Only do this for a file you downloaded
from the Allotment Releases page. Open **Terminal** (in **Applications →
Utilities**) and run this once, then open Allotment again:

```
xattr -dr com.apple.quarantine /Applications/Allotment.app
```

## Make an Up token

A personal access token lets Allotment read your Up accounts. It cannot move money.

1. Go to [api.up.com.au](https://api.up.com.au/) in a browser.
2. Follow the page's prompts to create a personal access token. Up asks you to confirm in the
   Up app on your phone.
3. Copy the token it shows you. Up only shows it once. Paste it straight into Allotment's
   **Up personal access token** box. Do not put it in an email, chat or GitHub issue.

What Allotment does with the token:

- It is stored encrypted on your own server (or computer). It is never in exported backups.
- Access is read-only. Allotment cannot spend, transfer or change anything in Up.
- Only settled transactions in Australian dollars are imported. Pending card holds are skipped.
- To cut off access completely, revoke the token in Up's developer portal. **Disconnect Up** in
  Allotment removes its saved copy and links but keeps your transactions.

More detail is in [Up support](../UP-SUPPORT.md).

## Coming from another app

- **From YNAB:** on the welcome screen select **Import from YNAB** and follow the steps.
- **From a spreadsheet or bank CSV:** open an account and select **Import CSV**.
- **Bringing history and linking Up:** when you connect Up and choose an account that already has
  transactions, Allotment asks for a **cut-over date**. Your older history stays exactly as it is.
  Up's transactions from that day on are added. Choose the day after your last imported row.

## Is HTTP safe at home? And away from home?

Allotment on Home Assistant uses `http://` on your home network. That is acceptable for a trusted
home network: the traffic stays inside your house and never crosses the internet. A stranger on
your Wi-Fi could in theory read it, so use a strong Wi-Fi password and do not run Allotment on a
guest network. That is why the connect screen asks you to tick **I trust this home network or VPN**.
Allotment never skips certificate checks.

Do not open port 3001 on your router, and Home Assistant Cloud (Nabu Casa) does not forward it. To
reach Allotment away from home, use a private network such as **Tailscale** (a free app that links
your devices as if they were home), or put Allotment behind a reverse proxy that gives it an
`https://` address. Both are described step by step in the
[Home Assistant app guide](../homeassistant/DOCS.md#reach-it-away-from-home). If you use a proxy, also
set `trust_proxy` in the app's **Configuration** tab.

## Something not working?

- **"Incorrect setup code":** the code changes each time the app restarts. Open the **Log** tab and
  copy the newest one.
- **The address will not load:** check that you used port **3001** and that the app shows **Started**.
- **Anything else:** [open an issue](https://github.com/tvrooi/Allotment/issues). Never include tokens, passwords or
  bank details in an issue.
