"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Mode = "light" | "dark";
export type ColorTheme = "nebula" | "aurora" | "ember";

export const COLOR_THEMES: { key: ColorTheme; label: string; swatch: string }[] = [
  { key: "nebula", label: "Nebula", swatch: "#8b5cf6" },
  { key: "aurora", label: "Aurora", swatch: "#2dd4bf" },
  { key: "ember", label: "Ember", swatch: "#fb923c" },
];

const MODE_KEY = "uge-mode";
const THEME_KEY = "uge-theme";

interface ThemeContextValue {
  mode: Mode;
  theme: ColorTheme;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  setTheme: (theme: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyToDocument(mode: Mode, theme: ColorTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  root.dataset.theme = theme;
  root.style.colorScheme = mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("dark");
  const [theme, setThemeState] = useState<ColorTheme>("nebula");

  useEffect(() => {
    const root = document.documentElement;
    const initialMode: Mode = root.classList.contains("dark") ? "dark" : "light";
    const initialTheme = (root.dataset.theme as ColorTheme) || "nebula";
    setModeState(initialMode);
    setThemeState(initialTheme);
  }, []);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    localStorage.setItem(MODE_KEY, next);
    const theme = (document.documentElement.dataset.theme as ColorTheme) || "nebula";
    applyToDocument(next, theme);
  }, []);

  const setTheme = useCallback((next: ColorTheme) => {
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
    const mode: Mode = document.documentElement.classList.contains("dark") ? "dark" : "light";
    applyToDocument(mode, next);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, theme, setMode, toggleMode, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// Inline script injected before paint to avoid a flash of the wrong theme.
export const NO_FLASH_SCRIPT = `(function(){try{var m=localStorage.getItem('${MODE_KEY}')||'dark';var t=localStorage.getItem('${THEME_KEY}')||'nebula';var r=document.documentElement;if(m==='dark'){r.classList.add('dark');r.classList.remove('light');}else{r.classList.remove('dark');r.classList.add('light');}r.dataset.theme=t;r.style.colorScheme=m;}catch(e){document.documentElement.classList.add('dark');document.documentElement.classList.remove('light');document.documentElement.dataset.theme='nebula';}})();`;
