function cssVar(name: string, fallback: string): string {
  // Preserve the CSS reference so even cached colour arrays follow theme changes.
  return `var(${name}, ${fallback})`;
}

export const chartColors = {
  get brand() {
    return cssVar('--color-chart-brand', '#487A78');
  },
  get brandLight() {
    return cssVar('--color-chart-brand-light', '#68908C');
  },
  get brandSubtle() {
    return cssVar('--color-chart-brand-subtle', '#DCEAE6');
  },
  get brandFill() {
    return cssVar('--color-chart-brand-fill', '#EFF5F2');
  },
  get positive() {
    return cssVar('--color-positive', '#1E7D55');
  },
  get positiveLight() {
    return cssVar('--color-chart-positive-light', '#699377');
  },
  get positiveFill() {
    return cssVar('--color-positive-subtle', '#E6F6EB');
  },
  get negative() {
    return cssVar('--color-negative', '#CB2B30');
  },
  get negativeLight() {
    return cssVar('--color-chart-negative-light', '#C77C71');
  },
  get negativeFill() {
    return cssVar('--color-negative-subtle', '#FEEBEC');
  },
  get caution() {
    return cssVar('--color-caution', '#A36000');
  },

  get grid() {
    return cssVar('--color-chart-grid', '#EFECE9');
  },
  get axis() {
    return cssVar('--color-chart-axis', '#696765');
  },
  get tooltipBorder() {
    return cssVar('--color-chart-tooltip-border', '#E4E1DE');
  },
  get tooltipBg() {
    return cssVar('--color-chart-tooltip-bg', '#FFFFFF');
  },
  get label() {
    return cssVar('--color-chart-label', '#5F5D5B');
  },
};

// Stable category order across themes; saved category colours remain untouched.
export const CATEGORY_COLORS = [
  '#487A78', // teal
  '#8C749C', // lavender
  '#B18442', // ochre
  '#6C8A65', // sage
  '#B86B50', // terracotta
  '#A86269', // rose
  '#637B9C', // denim
  '#8B8052', // olive
  '#52938B', // sea green
  '#BC8758', // clay
  '#82728E', // mauve
  '#9C7060', // cocoa
] as const;

/** Preserved super: the forecast's line and the accounts summary's bucket */
export const SUPER_COLOR = '#C026D3';
/** Wealth that can be spent now, beside net worth on the forecast */
export const ACCESSIBLE_COLOR = '#2563EB';
