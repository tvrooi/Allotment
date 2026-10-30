# Desktop updates

Connected desktops load budget screens from Home Assistant. **Budget → Reload** picks up server
changes without replacing the desktop application. Native desktop updates use
**Budget → Check for desktop updates…**, or a check a minute after launch. An available update
offers **Download installer** on unsigned builds: download and install it manually. No Apple Developer
account is needed. Verified signed Mac builds offer **Download update**, then **Restart and install**.
Choosing Later never restarts the app,
and quitting does not silently install. Updates never replace the server's database or key.

In-app installation is enabled only for packaged Mac apps whose Developer ID signature verifies.
Ad-hoc/development builds and other platforms offer the fork's downloads instead. Windows
Authenticode and Linux installer verification remain separate work; neither is bypassed.
The server page has no updater IPC bridge. Update checks use this fork's public GitHub Releases,
the `up` preview channel and no GitHub token. Downgrades are disabled, and Squirrel.Mac retains
its code-signature verification.

## Optional future Mac signing setup

The repository owner configures these **GitHub Actions repository secrets** at
[Allotment Actions secrets](https://github.com/tvrooi/Allotment/settings/secrets/actions).
Do not put values in chat, source code, an issue, a PR, or a terminal command argument.

| Secret                        | Value                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `CSC_LINK`                    | Base64 of a password-protected `.p12` export of your **Developer ID Application** certificate **and private key** |
| `CSC_KEY_PASSWORD`            | Password used when exporting that `.p12`                                                                          |
| `APPLE_ID`                    | Apple Developer account email used for notarization                                                               |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple app-specific password for notarization                                                                      |
| `APPLE_TEAM_ID`               | Ten-character Apple Developer team ID                                                                             |

Export the certificate with its private key from Keychain Access. If you need a certificate,
create a Developer ID Application certificate in your Apple Developer account first. Generating
credentials and accepting Apple agreements are owner steps. To copy a base64 certificate value
locally, run `base64 < /absolute/path/to/certificate.p12 | pbcopy`, then paste directly into
GitHub's secret form. Keep the original certificate/private key safely: subsequent updates must
use the same signing identity/team.

PR builds use ad-hoc signing and receive none of these secrets. With no signing configured, published
Mac builds remain ad-hoc and offer manual installer downloads. Once `CSC_LINK` is configured, a
published tag requires all five inputs, signs with hardened runtime, notarizes, and checks the stapled
notarization ticket for both Mac architectures. Incomplete configured signing or notarization failure
blocks publication. Set the Actions repository variable `MAC_SIGNING_REQUIRED=true` after enabling
signing to prevent an unsigned release if the certificate secret is later removed. ZIPs, update manifests and blockmaps accompany DMGs and receive the
same GitHub provenance attestations as installers. Signing secrets are used only in the Mac
tag build, after the tested-main release gate.

Install the first signed updater-enabled release manually once. Older installed versions contain
no updater and cannot bootstrap themselves. After that, test updating between two signed packaged
releases on the same Mac; unit tests and ad-hoc CI smoke tests do not prove that end-to-end path.

References: [electron-builder auto-update](https://www.electron.build/v26/docs/features/auto-update/),
[macOS signing](https://www.electron.build/v26/docs/code-signing/mac-code-signing/),
[Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).
