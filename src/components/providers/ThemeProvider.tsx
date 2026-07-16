import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'or-generator-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.classList.toggle('dark', resolvedTheme === 'dark');

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures and keep the app running.
    }
  }, [theme, resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const next = media.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      document.documentElement.classList.toggle('dark', next === 'dark');
    };

    media.addEventListener('change', handler);
    handler();

    return () => media.removeEventListener('change', handler);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: setThemeState,
    }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}