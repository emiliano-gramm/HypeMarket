"use client";

import { Moon, Sun } from "lucide-react";
import { COLOR_THEMES, useTheme } from "@/components/theme-provider";

export function ThemeSwitcher() {
  const { mode, theme, toggleMode, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-1 rounded-lg border border-edge bg-panel/60 p-1"
        role="radiogroup"
        aria-label="Color theme"
      >
        {COLOR_THEMES.map((t) => {
          const selected = theme === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t.label}
              title={t.label}
              onClick={() => setTheme(t.key)}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-transform hover:scale-110 ${
                selected ? "ring-2 ring-offset-1 ring-offset-panel" : ""
              }`}
              style={{ outlineColor: t.swatch }}
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{
                  backgroundColor: t.swatch,
                  boxShadow: selected ? `0 0 0 2px ${t.swatch}` : "none",
                }}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={toggleMode}
        aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-panel/60 text-ink-muted transition-colors hover:text-ink"
      >
        {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}
