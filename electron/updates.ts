// Native main-process controls only: no updater bridge is exposed to a remote budget page.
export const RELEASES_URL = 'https://github.com/tvrooi/Allotment/releases';
import type { ReleaseOffer } from './releaseCheck';
export interface UpdateDriver {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  on(event: string, listener: (info?: { version?: string }) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}
export interface UpdateUI {
  ask(message: string, detail: string, buttons: string[]): Promise<number>;
  openReleases(): void;
  openInstaller?(url: string): void;
}
export function signedMacIdentity(details: string, verified: boolean) {
  return (
    verified &&
    /^Authority=Developer ID Application: .+$/m.test(details) &&
    /^TeamIdentifier=[A-Z0-9]{10}$/m.test(details)
  );
}

export class DesktopUpdates {
  private state: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' =
    'idle';
  private manual = false;
  private handlingError = false;
  constructor(
    private driver: UpdateDriver,
    private ui: UpdateUI,
    private eligible: boolean,
    private installerCheck?: () => Promise<ReleaseOffer | null>,
  ) {
    driver.autoDownload = false;
    driver.autoInstallOnAppQuit = false;
    driver.allowPrerelease = true; // This fork intentionally ships the Up preview channel.
    driver.allowDowngrade = false;
    driver.on('error', () => {
      void this.failed();
    });
    driver.on('update-not-available', () => {
      this.state = 'idle';
      if (this.manual)
        void ui.ask('Allotment is up to date.', 'Your Home Assistant server updates separately.', [
          'OK',
        ]);
    });
    driver.on('update-available', (info) => {
      void this.available(info?.version);
    });
    driver.on('update-downloaded', () => {
      this.state = 'ready';
      void this.install();
    });
  }
  async check(manual = true) {
    if (!this.eligible) {
      if (this.installerCheck) {
        if (this.state !== 'idle') return;
        this.state = 'checking';
        this.manual = manual;
        try {
          const offer = await this.installerCheck();
          if (offer) {
            if (
              (await this.ui.ask(
                `Allotment ${offer.version} is available.`,
                'Download the correct desktop installer from your fork? It opens in your browser; install it to replace the desktop program. Your Home Assistant budget stays in place. This build cannot replace itself automatically.',
                ['Download installer', 'Later'],
              )) === 0
            )
              this.ui.openInstaller?.(offer.url);
          } else if (manual)
            await this.ui.ask(
              'Allotment is up to date.',
              'Your Home Assistant server updates separately.',
              ['OK'],
            );
        } catch {
          await this.failed();
        } finally {
          this.state = 'idle';
        }
        return;
      }
      if (
        manual &&
        (await this.ui.ask(
          'This desktop build uses manual updates.',
          'In-app installation is available in Developer ID signed Mac builds. Install that version once to receive future updates here. Other platforms can download installers from your fork. Server screens update with Budget → Reload.',
          ['Open downloads', 'Cancel'],
        )) === 0
      )
        this.ui.openReleases();
      return;
    }
    if (this.state === 'ready') {
      await this.install();
      return;
    }
    if (this.state !== 'idle') {
      if (manual)
        await this.ui.ask(
          'An update check or download is already running.',
          'Please wait, then check again.',
          ['OK'],
        );
      return;
    }
    this.manual = manual;
    this.state = 'checking';
    try {
      await this.driver.checkForUpdates();
    } catch {
      await this.failed();
    }
  }
  private async available(version?: string) {
    if (this.state !== 'checking') return;
    this.state = 'available';
    const label =
      version && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) && version.length < 80
        ? ` ${version}`
        : '';
    const choice = await this.ui.ask(
      `Allotment${label} is available.`,
      'Download the desktop update from tvrooi/Allotment? Your budget and Home Assistant server stay in place.',
      ['Download update', 'Later'],
    );
    if (choice !== 0) {
      this.state = 'idle';
      return;
    }
    this.manual = true; // A requested download should report a failure, including after a startup check.
    this.state = 'downloading';
    try {
      await this.driver.downloadUpdate();
    } catch {
      await this.failed();
    }
  }
  private async install() {
    if (this.state !== 'ready') return;
    // Block a second menu click from opening another restart prompt.
    this.state = 'installing';
    const choice = await this.ui.ask(
      'The desktop update is ready.',
      'Restart Allotment to install it? Home Assistant keeps running.',
      ['Restart and install', 'Later'],
    );
    if (choice !== 0) {
      this.state = 'ready';
      return;
    }
    try {
      this.driver.quitAndInstall(false, true);
    } catch {
      await this.failed();
    }
  }
  private async failed() {
    if (this.handlingError) return;
    this.handlingError = true;
    this.state = 'idle';
    if (!this.manual) {
      this.handlingError = false;
      return;
    }
    // Never display raw updater/network errors or relax signature verification after failure.
    if (
      (await this.ui.ask(
        'The desktop update could not be completed.',
        'Your current app is unchanged. Check your connection or download the installer from your fork. A signing or verification failure cannot be bypassed here.',
        ['OK', 'Open downloads'],
      )) === 1
    )
      this.ui.openReleases();
    this.handlingError = false;
  }
}
