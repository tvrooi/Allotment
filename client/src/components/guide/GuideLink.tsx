import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DocsPage } from '../../utils/project';

/**
 * A link to a page of Allotment's own guide (/guide), which the app serves itself: it works
 * offline, on every install, and in the demo, and never leaves Allotment.
 */
export function GuideLink({
  page,
  className = '',
  onClick,
  children,
}: {
  page?: DocsPage;
  className?: string;
  /** For a link inside a dialog: close it, or it stays open over the guide */
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Link to={page ? `/guide/${page}` : '/guide'} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
