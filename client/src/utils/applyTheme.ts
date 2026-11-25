import { usePreferencesStore, type Theme } from '../store/preferencesStore';

function setDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  // The browser and iPhone status bar take the header colour, read from the theme's own token
  const headerColour = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-sidebar-bg')
    .trim();
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta && headerColour) meta.content = headerColour;
}

function apply(theme: Theme) {
  if (theme === 'dark') {
    setDark(true);
  } else if (theme === 'light') {
    setDark(false);
  } else {
    setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
}

// `?theme=dark|light` pins one window's theme without touching the saved preference,
// so design tools can show light and dark side by side.
function themeOverride(): Theme | null {
  const value = new URLSearchParams(window.location.search).get('theme');
  return value === 'dark' || value === 'light' ? value : null;
}

export function initTheme() {
  const override = themeOverride();
  if (override) {
    apply(override);
    return;
  }
  const theme = usePreferencesStore.getState().theme;
  apply(theme);

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (usePreferencesStore.getState().theme === 'system') {
      setDark(mq.matches);
    }
  });

  usePreferencesStore.subscribe((state) => apply(state.theme));
}
