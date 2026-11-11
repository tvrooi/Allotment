import { NavLink } from 'react-router-dom';
import { ArrowLeftRight, ClipboardCheck, LayoutDashboard, Plus, Wallet } from 'lucide-react';
import { useAddTransactionStore } from '../../store/addTransactionStore';
import { useCanAddTransaction } from '../../hooks/useOffline';

const TAB = 'flex flex-col items-center justify-center gap-0.5 min-h-14 text-2xs font-medium';
const PILL = 'h-8 w-12 flex items-center justify-center rounded-full transition-colors';

function Tab({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  // NavLink marks the current one with aria-current="page"
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${TAB} ${isActive ? 'text-sidebar-text-hi' : 'text-sidebar-text'}`
      }
    >
      {({ isActive }) => (
        <>
          <span aria-hidden className={`${PILL} ${isActive ? 'bg-sidebar-active' : ''}`}>
            {icon}
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
}

/**
 * Phones: the everyday pages one tap away, with Add transaction in the centre. Everything
 * else stays in the menu drawer. It sits below the page, not over it, and keeps clear of the
 * home indicator (the page's own bottom inset moved here).
 */
export function PhoneTabBar() {
  const show = useAddTransactionStore((s) => s.show);
  const { allowed, hint } = useCanAddTransaction();
  return (
    <nav
      aria-label="Main pages"
      className="shrink-0 grid grid-cols-5 border-t border-sidebar-border bg-sidebar-bg pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      <Tab to="/dashboard" label="Home" icon={<LayoutDashboard size={20} />} />
      <Tab to="/transactions" label="Transactions" icon={<ArrowLeftRight size={20} />} />
      <button
        type="button"
        onClick={show}
        disabled={!allowed}
        aria-label="Add a transaction"
        title={hint}
        className={`${TAB} text-sidebar-text-hi disabled:opacity-50`}
      >
        <span aria-hidden className={`${PILL} bg-brand-600 text-brand-contrast`}>
          <Plus size={20} />
        </span>
        Add
      </button>
      <Tab to="/budget" label="Budget" icon={<Wallet size={20} />} />
      <Tab to="/review" label="Review" icon={<ClipboardCheck size={20} />} />
    </nav>
  );
}
