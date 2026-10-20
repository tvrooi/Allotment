import { app, dialog, shell } from 'electron';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { DesktopUpdates, RELEASES_URL, signedMacIdentity } from './updates';
import { checkInstallerRelease, isForkInstaller, installerName } from './releaseCheck';

export function desktopUpdates() {
  let eligible = false;
  if (app.isPackaged && process.platform === 'darwin') {
    const bundle = path.resolve(process.resourcesPath, '../..');
    const verify = spawnSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], {
      encoding: 'utf8',
      timeout: 15000,
    });
    const details = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=4', bundle], {
      encoding: 'utf8',
      timeout: 15000,
    });
    eligible = signedMacIdentity(details.stderr ?? '', verify.status === 0 && details.status === 0);
  }
  return new DesktopUpdates(
    autoUpdater,
    {
      ask: async (message, detail, buttons) =>
        (
          await dialog.showMessageBox({
            type: 'info',
            message,
            detail,
            buttons,
            defaultId: 0,
            cancelId: buttons[0] === 'OK' ? 0 : buttons.length - 1,
            noLink: true,
          })
        ).response,
      openReleases: () => {
        void shell.openExternal(RELEASES_URL);
      },
      openInstaller: (url) => {
        const name = installerName(process.platform, process.arch);
        const tag = new URL(url).pathname.split('/').at(-2)!;
        if (name && isForkInstaller(url, tag, name)) void shell.openExternal(url);
      },
    },
    eligible,
    app.isPackaged
      ? () => checkInstallerRelease(app.getVersion(), process.platform, process.arch)
      : undefined,
  );
}
