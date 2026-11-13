/**
 * A tick that ends in a leaf: Ready to assign is at $0, every dollar has a job (#241).
 * It draws itself once when you bring the month there (`animate`), and is still otherwise
 * and with reduced motion. Decorative: the words beside it say the same.
 */
export function SproutTick({ animate }: { animate: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden
      focusable="false"
      data-testid="sprout-tick"
      data-animate={animate}
      className="shrink-0 text-current"
    >
      <path
        d="M3.5 10.5 7.5 14.5 14.5 6"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1"
        data-motion
        className={animate ? 'animate-tick-draw' : undefined}
      />
      <path
        d="M14.5 6C14.6 3.4 16.6 1.9 19 2c-.1 2.5-1.9 4.2-4.5 4Z"
        fill="currentColor"
        style={{ transformOrigin: '14.5px 6px' }}
        data-motion
        className={animate ? 'animate-leaf-in' : undefined}
      />
    </svg>
  );
}
