"use client";

import { useTheme } from "@/lib/theme-context";

export function ThemeToggle({ size = "md" }: { size?: "sm" | "md" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Light mode" : "Dark mode"}
      style={{
        background: "none",
        border: "1px solid var(--c-border)",
        borderRadius: 8,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: size === "sm" ? "3px 8px" : "5px 10px",
        color: "var(--c-text-muted)",
        transition: "color 0.2s, border-color 0.2s",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: size === "sm" ? 13 : 15, lineHeight: 1 }}>
        {isDark ? "☀️" : "🌙"}
      </span>
      <span style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: size === "sm" ? 8 : 9,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
      }}>
        {isDark ? "Light" : "Dark"}
      </span>
    </button>
  );
}
