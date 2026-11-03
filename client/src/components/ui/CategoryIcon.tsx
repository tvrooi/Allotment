import { CATEGORY_ICONS, categoryIconName } from '../../utils/categoryIcons';

/**
 * A category's or goal's icon, drawn as the app's line icon (older budgets' emoji show as
 * the nearest one). Nothing when there's no icon.
 */
export function CategoryIcon({
  icon,
  size = 16,
  className = '',
}: {
  icon: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const name = categoryIconName(icon);
  const Icon = name ? CATEGORY_ICONS[name] : null;
  if (!Icon) return null;
  return <Icon size={size} aria-hidden className={`shrink-0 text-text-tertiary ${className}`} />;
}
