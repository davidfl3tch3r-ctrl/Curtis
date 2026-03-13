"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface NavLink {
  label: string;
  href: string;
}

interface NavBarProps {
  /** Navigation links shown in the center on desktop / drawer on mobile */
  links?: NavLink[];
  /** Label of the currently active link */
  activeLabel?: string;
  /** Content rendered on the right side of the nav (theme toggle, avatar, etc.) */
  right?: React.ReactNode;
  /** Whether to show the default ThemeToggle when no right content is provided */
  showThemeToggle?: boolean;
}

export function NavBar({
  links = [],
  activeLabel,
  right,
  showThemeToggle = true,
}: NavBarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close drawer on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const Logo = () => (
    <Link href="/" style={{ textDecoration: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{
          width: 34, height: 34,
          background: "linear-gradient(135deg, #FF5A1F 0%, #E8400A 100%)",
          borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 3px 10px rgba(255,90,31,0.35)", flexShrink: 0,
        }}>
          <span style={{ color: "white", fontSize: 16 }}>◆</span>
        </div>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, color: "var(--c-text)" }}>CURTIS</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.14em", color: "#FF5A1F", textTransform: "uppercase" }}>Draft Football</div>
        </div>
      </div>
    </Link>
  );

  return (
    <>
      {/* ── TOP NAV ── */}
      <nav style={{
        minHeight: 58,
        background: "var(--c-bg)",
        borderBottom: "1px solid var(--c-border-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingLeft: "clamp(16px, 4vw, 44px)",
        paddingRight: "clamp(16px, 4vw, 44px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <Logo />

        {/* ── Desktop nav links (hidden on mobile via CSS) ── */}
        {links.length > 0 && (
          <div className="nav-links-desktop" style={{ display: "flex", gap: 28, overflowX: "auto" }}>
            {links.map(item => (
              <Link
                key={item.label}
                href={item.href}
                className={`nav-link${activeLabel === item.label ? " active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {/* ── Right slot ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {right ?? (showThemeToggle ? <ThemeToggle size="sm" /> : null)}

          {/* Hamburger — only shown on mobile via CSS */}
          {links.length > 0 && (
            <button
              className="nav-hamburger"
              onClick={() => setOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={open}
              style={{
                background: "none",
                border: "1px solid var(--c-border-strong)",
                borderRadius: 8,
                cursor: "pointer",
                padding: "8px 10px",
                color: "var(--c-text-muted)",
                lineHeight: 1,
                minWidth: 44,
                minHeight: 44,
                display: "none", // shown by CSS media query
                alignItems: "center",
                justifyContent: "center",
                fontSize: 17,
              }}
            >
              ☰
            </button>
          )}
        </div>
      </nav>

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={close}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
          />

          {/* Drawer panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(300px, 85vw)",
              zIndex: 201,
              background: "var(--c-bg-elevated)",
              borderLeft: "1px solid var(--c-border-strong)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              animation: "drawerSlideIn 0.24s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <style>{`
              @keyframes drawerSlideIn {
                from { transform: translateX(100%); opacity: 0.5; }
                to   { transform: translateX(0);    opacity: 1; }
              }
            `}</style>

            {/* Drawer header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 20px",
              borderBottom: "1px solid var(--c-border)",
              flexShrink: 0,
            }}>
              <Logo />
              <button
                onClick={close}
                aria-label="Close menu"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--c-text-muted)",
                  fontSize: 20,
                  padding: "6px",
                  minWidth: 44,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                }}
              >
                ✕
              </button>
            </div>

            {/* Links */}
            <nav style={{ flex: 1, padding: "8px 0" }}>
              {links.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={close}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 24px",
                    height: 52,
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: activeLabel === item.label ? "#FF5A1F" : "var(--c-text-muted)",
                    textDecoration: "none",
                    borderLeft: `3px solid ${activeLabel === item.label ? "#FF5A1F" : "transparent"}`,
                    background: activeLabel === item.label ? "var(--c-accent-dim)" : "transparent",
                    transition: "color 0.15s",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Drawer footer — theme toggle */}
            <div style={{
              padding: "16px 24px",
              paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
              borderTop: "1px solid var(--c-border)",
              flexShrink: 0,
            }}>
              <ThemeToggle />
            </div>
          </div>
        </>
      )}
    </>
  );
}
