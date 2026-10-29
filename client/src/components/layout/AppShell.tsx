import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, Menu } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts';
import { useIsPhone } from '../../hooks/useIsPhone';
import { usePreferencesStore } from '../../store/preferencesStore';
import { useUndoKeyboard } from '../../hooks/useUndoKeyboard';
import { useSafeModeKeyboard } from '../../hooks/useSafeModeKeyboard';
import { useSafeMode } from '../../utils/safeMode';
import { Toasts } from '../ui/Toasts';
import { ConnectionBanner } from '../connection/ConnectionBanner';
import { DemoBanner } from '../demo/DemoBanner';
import { Sidebar, SidebarDrawer, SafeModeButton } from './Sidebar';
import { BrandName } from '../ui/BrandName';
import logoUrl from '/logo.png';
import { useUpFreshness } from '../../hooks/useUp';

export function AppShell() {
  useUndoKeyboard();
  useSafeModeKeyboard();
  useUpFreshness();
  // Safe mode hiding every amount does it in the money formatters, which don't re-render
  // anything: the shell is drawn again when that changes (cached data makes it quick)
  const hidesAll = useSafeMode().all;
  const { data: accounts = [], isLoading } = useAccounts();
  const setupSkipped = usePreferencesStore((s) => s.setupSkipped);
  const isPhone = useIsPhone();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-page">
        <Loader2 size={32} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (accounts.length === 0 && !setupSkipped) {
    return <Navigate to="/welcome" replace />;
  }

  if (isPhone) return <PhoneShell key={String(hidesAll)} />;

  return (
    <div key={String(hidesAll)} className="flex h-screen bg-page overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* macOS desktop app: the window has no title bar, so this strip moves it */}
        <div
          aria-hidden
          className="mac-title-strip hidden mac-window:block h-10 shrink-0 drag-region"
        />
        <DemoBanner />
        <ConnectionBanner />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  );
}

/**
 * Phones: a top bar with a menu button; the sidebar slides in as a drawer. Escape, the
 * backdrop, the close button or following a link closes it, and focus goes back to the
 * menu button. While it's open the page behind is inert.
 */
function PhoneShell() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const refocusMenuButton = useRef(false);
  const location = useLocation();

  // Closing by hand (Escape, backdrop, close button) puts focus back on the menu button,
  // once the page behind is no longer inert
  const close = () => {
    refocusMenuButton.current = true;
    setOpen(false);
  };

  // Following a link in the drawer closes it
  useEffect(() => setOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (!open) {
      if (refocusMenuButton.current) menuButton.current?.focus();
      refocusMenuButton.current = false;
      return;
    }
    document.querySelector<HTMLElement>('#app-sidebar a, #app-sidebar button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="flex flex-col h-dvh bg-page overflow-hidden">
      <SidebarDrawer open={open} onClose={close} />
      <div inert={open} className="flex-1 min-h-0 flex flex-col">
        {/* macOS desktop app (a narrow window): clear of the traffic lights, and moves the window */}
        <header className="shrink-0 flex items-center gap-2 h-12 px-2 mac-window:pl-20 mac-window:drag-region bg-sidebar-bg border-b border-sidebar-border">
          <button
            ref={menuButton}
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="app-sidebar"
            className="p-2 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md text-sidebar-text-hi hover:bg-sidebar-hover no-drag-region"
          >
            <Menu size={20} />
          </button>
          <img src={logoUrl} alt="" className="w-6 h-6" />
          <BrandName
            className="text-sm font-semibold tracking-tight"
            flyClassName="text-brand-600"
            budgetClassName="text-sidebar-text-hi"
          />
          <SafeModeButton className="relative ml-auto p-2 min-w-11 min-h-11 flex items-center justify-center rounded-md text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-hi no-drag-region" />
        </header>
        <DemoBanner />
        <ConnectionBanner />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  );
}
