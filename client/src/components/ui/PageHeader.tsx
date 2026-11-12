import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PAGE_GUTTER } from './pageGutter';

interface Breadcrumb {
  label: string;
  to?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, tabs, breadcrumbs, children }: Props) {
  return (
    <div className="bg-page border-b border-border-light shrink-0">
      <div className={`py-4 ${PAGE_GUTTER}`}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-text-tertiary mb-2">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} />}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-text-secondary transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-text-secondary">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
          <div>
            <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
              {title}
            </h1>
            {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
      {tabs && <div className={PAGE_GUTTER}>{tabs}</div>}
      {children && <div className={`pb-4 ${PAGE_GUTTER}`}>{children}</div>}
    </div>
  );
}
