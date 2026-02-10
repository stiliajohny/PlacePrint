"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "placeprint-theme-preference";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

const THEME_OPTIONS: Array<{ id: ThemePreference; label: string }> = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" }
];

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light";
}

function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  const root = document.documentElement;
  if (preference === "system") {
    root.removeAttribute("data-theme");
    root.setAttribute("data-theme-preference", "system");
    return getSystemTheme();
  }

  root.setAttribute("data-theme", preference);
  root.setAttribute("data-theme-preference", preference);
  return preference;
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initialPreference = isThemePreference(stored) ? stored : "system";
    setPreference(initialPreference);
    setResolvedTheme(applyThemePreference(initialPreference));
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    setResolvedTheme(applyThemePreference(preference));

    if (preference === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, preference);
  }, [isReady, preference]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const mediaQueryList = window.matchMedia(SYSTEM_DARK_QUERY);
    const onSystemThemeChange = () => {
      if (preference === "system") {
        setResolvedTheme(applyThemePreference("system"));
      }
    };

    mediaQueryList.addEventListener("change", onSystemThemeChange);
    return () => {
      mediaQueryList.removeEventListener("change", onSystemThemeChange);
    };
  }, [isReady, preference]);

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme preference">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`theme-toggle-button${preference === option.id ? " is-active" : ""}`}
          aria-pressed={preference === option.id}
          onClick={() => setPreference(option.id)}
        >
          {option.label}
        </button>
      ))}
      <span className="theme-toggle-status" aria-live="polite">
        {preference === "system" ? `Auto: ${resolvedTheme}` : `Using ${preference}`}
      </span>
    </div>
  );
}
