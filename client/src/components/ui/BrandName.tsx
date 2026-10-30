interface Props {
  className?: string;
  /** Color of the wordmark: the page's text color by default (Soil, or white in dark mode) */
  textClassName?: string;
}

/** The Allotment wordmark: one bold word, set tight, in the text color */
export function BrandName({ className = '', textClassName = 'text-text' }: Props) {
  return (
    <span className={`font-bold tracking-tighter ${textClassName} ${className}`}>Allotment</span>
  );
}
