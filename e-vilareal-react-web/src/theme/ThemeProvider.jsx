import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredDarkMode, setStoredDarkMode, THEME_DARK_STORAGE_KEY } from './themeStorage.js';

const ThemeContext = createContext({
  dark: false,
  setDark: () => {},
  toggleDark: () => {},
});

/**
 * Tema global: adiciona/remove a classe `dark` em <html> e persiste em localStorage.
 */
export function ThemeProvider({ children }) {
  const [dark, setDarkState] = useState(() => getStoredDarkMode());

  const setDark = useCallback((value) => {
    setDarkState(Boolean(value));
  }, []);

  const toggleDark = useCallback(() => {
    setDarkState((d) => !d);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    setStoredDarkMode(dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', dark ? '#121212' : '#6b1c2e');
    }
  }, [dark]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== THEME_DARK_STORAGE_KEY || e.newValue == null) return;
      setDarkState(e.newValue === '1');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(
    () => ({
      dark,
      setDark,
      toggleDark,
    }),
    [dark, setDark, toggleDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
