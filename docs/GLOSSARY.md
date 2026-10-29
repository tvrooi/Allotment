# Glossary

Plain-language meanings for the words you meet while installing and using FlyBudget.
Back to [Start here](START-HERE.md).

## Installing

- **App (Home Assistant):** a program that runs inside Home Assistant. Older versions call it an add-on.
- **Catalog repository:** a web address that tells Home Assistant where to find extra apps. You add it once.
- **Advanced mode:** a switch on your Home Assistant user profile that shows extra menus.
- **Protection mode:** a Home Assistant safety setting. Leave it on.
- **Watchdog:** a Home Assistant setting that restarts the app if it stops responding.
- **Log tab:** the page in an app that shows what it has been doing. FlyBudget prints its setup code there.
- **Setup code:** a one-time code that proves you own the server when you first create your password. It changes on every restart.
- **Port (3001 and 8123):** a number added to an address. FlyBudget uses 3001. Home Assistant's own pages use 8123.
- **`homeassistant.local`:** a name your network may understand in place of Home Assistant's number address.
- **LAN / home network:** the devices connected to your own router.
- **HTTP and HTTPS:** how a web page travels. HTTPS is scrambled so others cannot read it. HTTP is not, which is fine inside a trusted home network.
- **VPN / Tailscale:** a private link between your devices that works from anywhere, as if you were at home.
- **Reverse proxy:** a helper that gives a server a secure `https://` address.
- **DMG, `.exe`, `.deb`, AppImage:** the installer file types for Mac, Windows and Linux.
- **Apple silicon (`arm64`) and Intel (`x64`):** the two kinds of Mac chip. The download file name uses `arm64` for M1 to M4 Macs and `x64` for Intel Macs.
- **Unsigned / not notarised:** the app is not registered with Apple or Microsoft, so your computer warns you the first time. See [Start here](START-HERE.md).
- **Multi-user mode:** an optional setting that gives each person their own private budget on one server.

## Up Bank

- **Personal access token:** a long password that lets one program read your Up accounts. You create it at api.up.com.au.
- **Read-only:** can look, cannot change. FlyBudget cannot move money with your Up token.
- **Settled:** a transaction Up has finished processing. Pending card holds are not imported.
- **Savers:** Up's savings accounts.
- **Round Ups:** Up's feature that rounds a purchase up and moves the spare change into a Saver.
- **2Up:** Up's joint account.
- **Sync Now:** the button that fetches new transactions from Up straight away.
- **Cut-over date:** the day FlyBudget stops using your older imported history for an account and starts using Up's transactions. Older rows stay as they are.
- **Sort step:** the screen after your first import where you pick a category for each payee. See [Start here](START-HERE.md).

## Budgeting

- **Payee:** the shop or person a transaction was paid to.
- **Category:** what a transaction was for, such as Groceries.
- **Ready to assign:** money you have in on-budget accounts that is not yet given a job in a category.
- **Envelope:** a category treated as a pot of money you have set aside.
- **Anchor payday:** one real payday date a payday plan counts from. Pay repeats every 14 days from it.
- **Funding rule:** a line in a payday plan that says how much to put in a category each pay. See [payday plans](PAYDAY-PLANS.md).
- **Reconcile:** check that FlyBudget's balance for an account matches your bank's, and fix the difference.
- **Transfer:** money moving between your own accounts. It is not income or spending.
- **Backup (JSON export):** a file of your budget from **Settings → Data**. It never includes your Up token.
