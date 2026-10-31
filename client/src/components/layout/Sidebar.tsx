import { useState, useCallback, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  Wallet,
  Repeat,
  BarChart3,
  Workflow,
  Target,
  House,
  TrendingUp,
  Users,
  Zap,
  Settings,
  Pin,
  X,
  CircleHelp,
  ClipboardCheck,
  CandlestickChart,
  Receipt,
  Eye,
  EyeOff,
  CalendarClock,
} from 'lucide-react';
import { usePreferencesStore } from '../../store/preferencesStore';
import { useSafeModeStore } from '../../store/safeModeStore';
import { SidebarAccountList } from './SidebarAccountList';
import { ServerStatus } from './ServerStatus';
import { DOCS_URL } from '../../utils/project';
import { BrandName } from '../ui/BrandName';
import logoUrl from '/logo.png';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}

function NavItem({ to, icon, label, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        // Phones (the drawer): full-size touch targets
        `flex items-center gap-3 py-2 max-md:min-h-11 max-md:text-[15px] px-3 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-sidebar-active text-sidebar-text-hi'
            : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-hi'
        }`
      }
    >
      {icon}
      <span
        className={`truncate transition-opacity duration-200 ${
          collapsed ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {label}
      </span>
    </NavLink>
  );
}

export function Sidebar() {
  const sidebarMode = usePreferencesStore((s) => s.sidebarMode);

  // Tracked in both modes, so unpinning keeps the sidebar open until the pointer leaves it
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const pointerDown = useRef(false);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const isAutoHide = sidebarMode === 'auto-hide';
  const isExpanded = isAutoHide ? hovered || focusWithin : true;

  // One layout for both modes, so pinning and unpinning slide the page instead of jumping:
  // the aside holds the page's space and animates between the rail and full width, and the
  // panel inside overlays the page while an unpinned sidebar is open.
  // macOS desktop app: the collapsed rail is 92px so the traffic lights get even margins.
  return (
    <aside
      // Focus keeps an unpinned sidebar open, except focus from a click (on the pin, a link),
      // or it would stay open after the pointer leaves
      onPointerDownCapture={() => {
        pointerDown.current = true;
        // Listened for on the window: the press may end outside the sidebar
        const done = new AbortController();
        const release = () => {
          pointerDown.current = false;
          done.abort();
        };
        window.addEventListener('pointerup', release, { capture: true, signal: done.signal });
        window.addEventListener('pointercancel', release, { capture: true, signal: done.signal });
      }}
      onFocusCapture={() => {
        if (!pointerDown.current) setFocusWithin(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`shrink-0 h-screen relative z-30 transition-[width] duration-200 ${
        isAutoHide ? 'w-16 mac-window:w-[92px]' : 'w-[232px] mac-window:w-[246px]'
      }`}
    >
      {/* overflow-clip, not hidden: tabbing to a control the rail hides mustn't scroll the
          panel sideways */}
      <div
        className={`absolute left-0 top-0 h-full overflow-clip border-r border-sidebar-border transition-[width,box-shadow] duration-200 ${
          isExpanded ? 'w-[232px] mac-window:w-[246px]' : 'w-16 mac-window:w-[92px]'
        } ${isAutoHide && isExpanded ? 'shadow-xl' : ''}`}
      >
        <SidebarContent isExpanded={isExpanded} />
      </div>
    </aside>
  );
}

/** The sidebar's links, account list and footer, shared by the desktop sidebar and the phone drawer. */
function SidebarContent({ isExpanded, onClose }: { isExpanded: boolean; onClose?: () => void }) {
  const sidebarMode = usePreferencesStore((s) => s.sidebarMode);
  const setSidebarMode = usePreferencesStore((s) => s.setSidebarMode);
  const pinned = sidebarMode === 'persistent';
  const headerButton =
    'relative p-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-hi';

  return (
    // macOS desktop app: the collapsed rail is 28px wider (room for the traffic lights), so
    // everything moves 14px right to stay centred in it
    <div className="w-[232px] mac-window:w-[246px] mac-window:pl-3.5 h-full flex flex-col bg-sidebar-bg">
      {/* macOS desktop app: room for the traffic lights, and a handle to move the window */}
      {!onClose && (
        <div aria-hidden className="hidden mac-window:block h-10 shrink-0 drag-region" />
      )}
      {/* Logo */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
        <img src={logoUrl} alt="" className="w-7 h-7 shrink-0" />
        {/* Brand colours follow the light and dark navigation surfaces. */}
        <BrandName
          className={`text-base transition-opacity duration-200 ${
            isExpanded ? 'opacity-100' : 'opacity-0'
          }`}
          textClassName="text-sidebar-text-hi"
        />
        <div
          className={`ml-auto -mr-1.5 flex items-center gap-0.5 transition-opacity duration-200 ${
            isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Help & docs (opens in a new tab)"
            className={`group ${headerButton}`}
          >
            <CircleHelp size={16} aria-hidden />
            <HeaderTooltip>Help &amp; docs</HeaderTooltip>
          </a>
          <SafeModeButton className={`group ${headerButton}`} />
          {/* The phone drawer closes; the desktop sidebar has a pin instead: pinned stays open,
              unpinned collapses and opens on hover (the Sidebar setting in Preferences) */}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className={headerButton}
            >
              <X size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarMode(pinned ? 'auto-hide' : 'persistent')}
              aria-pressed={pinned}
              aria-label="Pin sidebar"
              className={`group ${headerButton}`}
            >
              <Pin
                size={16}
                aria-hidden
                fill={pinned ? 'currentColor' : 'none'}
                className={pinned ? 'text-sidebar-text-hi' : undefined}
              />
              <HeaderTooltip>{pinned ? 'Unpin sidebar' : 'Pin sidebar'}</HeaderTooltip>
            </button>
          )}
        </div>
      </div>

      {/* Navigation and accounts share a scroll area on short screens. */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {/* Primary nav */}
        <nav className="pt-4 px-3 space-y-1">
          <NavItem
            to="/dashboard"
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/accounts"
            icon={<Landmark size={18} />}
            label="Accounts"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/transactions"
            icon={<ArrowLeftRight size={18} />}
            label="Transactions"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/budget"
            icon={<Wallet size={18} />}
            label="Budget"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/review"
            icon={<ClipboardCheck size={18} />}
            label="Review"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/recurring"
            icon={<Repeat size={18} />}
            label="Recurring"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/payment-plans"
            icon={<CalendarClock size={18} />}
            label="Pay later"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/household"
            icon={<House size={18} />}
            label="Household"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/reports"
            icon={<BarChart3 size={18} />}
            label="Reports"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/cash-flow"
            icon={<Workflow size={18} />}
            label="Cash Flow"
            collapsed={!isExpanded}
          />
          <NavItem to="/goals" icon={<Target size={18} />} label="Goals" collapsed={!isExpanded} />
          <NavItem
            to="/forecast"
            icon={<TrendingUp size={18} />}
            label="Forecast"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/investments"
            icon={<CandlestickChart size={18} />}
            label="Investments"
            collapsed={!isExpanded}
          />
          <NavItem
            to="/tax"
            icon={<Receipt size={18} />}
            label="Tax time"
            collapsed={!isExpanded}
          />
        </nav>

        {/* Account list */}
        <div
          className={`flex flex-col min-h-40 pb-3 transition-opacity duration-200 ${
            isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <SidebarAccountList />
        </div>
      </div>

      {/* Footer nav */}
      <nav className="shrink-0 py-3 px-3 border-t border-sidebar-border space-y-1">
        <NavItem to="/payees" icon={<Users size={18} />} label="Payees" collapsed={!isExpanded} />
        <NavItem to="/rules" icon={<Zap size={18} />} label="Rules" collapsed={!isExpanded} />
        <NavItem
          to="/settings"
          icon={<Settings size={18} />}
          label="Settings"
          collapsed={!isExpanded}
        />
      </nav>

      {/* Where the data lives and whether the server is reachable */}
      <div className="shrink-0 py-1.5 px-3 border-t border-sidebar-border">
        <ServerStatus collapsed={!isExpanded} />
      </div>
    </div>
  );
}

/** Safe mode on or off: hides balances and totals while someone else looks at the screen */
export function SafeModeButton({ className }: { className: string }) {
  const on = useSafeModeStore((s) => s.on);
  const toggle = useSafeModeStore((s) => s.toggle);
  const Icon = on ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label="Safe mode"
      aria-keyshortcuts="Alt+Shift+H"
      className={className}
    >
      <Icon size={16} aria-hidden className={on ? 'text-brand-600' : undefined} />
      <HeaderTooltip>{on ? 'Show balances' : 'Hide balances'}</HeaderTooltip>
    </button>
  );
}

/** A small label under a sidebar header icon, shown on hover and keyboard focus */
function HeaderTooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-full right-0 mt-1.5 z-10 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-md:hidden"
    >
      {children}
    </span>
  );
}

/**
 * Phones: the sidebar slides in over the page from a menu button (see AppShell). It's
 * inert while closed, so its links can't be reached by Tab or screen readers.
 */
export function SidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 animate-fade-in"
        />
      )}
      <aside
        id="app-sidebar"
        inert={!open}
        // Hidden once closed (so nothing inside can be reached), but only after sliding out;
        // visible straight away when opening, so focus can move in
        className={`fixed inset-y-0 left-0 z-50 w-[232px] max-w-[85vw] overflow-hidden duration-200 ${
          open
            ? 'visible translate-x-0 shadow-xl transition-[translate]'
            : 'invisible -translate-x-full transition-[translate,visibility]'
        }`}
      >
        <SidebarContent isExpanded onClose={onClose} />
      </aside>
    </>
  );
}
