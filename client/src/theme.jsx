import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

function readInitial() {
  try {
    const saved = localStorage.getItem('andaman.theme');
    if (saved) return saved === 'dark';
  } catch {
    /* ignore */
  }
  return false; // light by default (matches reference)
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem('andaman.theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);

  return <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
