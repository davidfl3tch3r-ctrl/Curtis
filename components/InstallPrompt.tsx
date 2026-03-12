"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme-context";

// BeforeInstallPromptEvent is not in the standard TS lib yet.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ─── iOS share-sheet icon (the ↑ box Safari uses) ────────────────────────────
function IosShareIcon() {
  return (
    <svg
      width="14"
      height="17"
      viewBox="0 0 24 28"
      fill="currentColor"
      style={{ display: "inline-block", verticalAlign: "middle", margin: "0 3px -2px" }}
      aria-hidden="true"
    >
      <path d="M12 0L5.5 6.5 7 8l4-4v16h2V4l4 4 1.5-1.5L12 0z" />
      <path d="M20 11h-3v2h3v13H4V13h3v-2H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V13a2 2 0 0 0-2-2z" />
    </svg>
  );
}

// ─── Diamond icon (matches nav logo) ─────────────────────────────────────────
function AppIcon() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        flexShrink: 0,
        background: "linear-gradient(135deg, #FF5A1F 0%, #E8400A 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 3px 12px rgba(255,90,31,0.4)",
        fontSize: 24,
        color: "white",
      }}
    >
      ◆
    </div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const DISMISS_KEY  = "curtis-install-dismissed";
const DISMISS_DAYS = 7;

export function InstallPrompt() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [show,           setShow]           = useState(false);
  const [platform,       setPlatform]       = useState<"ios" | "android" | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible,        setVisible]        = useState(false); // controls CSS transition

  useEffect(() => {
    // Already running as installed PWA — hide everything.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Dismissed recently — respect user's choice.
    const ts = localStorage.getItem(DISMISS_KEY);
    if (ts && Date.now() - Number(ts) < DISMISS_DAYS * 86_400_000) return;

    // Desktop browsers: skip (no useful install banner needed).
    const isMobile =
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth < 768;
    if (!isMobile) return;

    const ua        = navigator.userAgent;
    const isIos     = /iPhone|iPad|iPod/i.test(ua);
    // Safari on iOS: no "chrome" in UA; also exclude in-app browsers.
    const isSafari  = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua);

    if (isIos && isSafari) {
      setPlatform("ios");
      const t = setTimeout(() => { setShow(true); requestAnimationFrame(() => setVisible(true)); }, 4000);
      return () => clearTimeout(t);
    }

    // Android / Chrome — wait for native beforeinstallprompt event.
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      const t = setTimeout(() => { setShow(true); requestAnimationFrame(() => setVisible(true)); }, 2000);
      // Store timer id so it can be cleared — but as a side-effect only.
      return t;
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    // Wait for slide-out animation before unmounting.
    setTimeout(() => setShow(false), 320);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setShow(false);
  }

  if (!show || !platform) return null;

  // ── Colours ────────────────────────────────────────────────────────────────
  const bg         = isDark ? "#241A14" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255,255,255,0.11)" : "#EDE5D8";
  const heading    = isDark ? "#F5F0E8" : "#1C1410";
  const body       = isDark ? "#8B7355" : "#7A6650";
  const btnBorder  = isDark ? "rgba(255,255,255,0.12)" : "#EDE5D8";
  const dimBtn     = isDark ? "#8B7355" : "#A89880";
  const closeColor = isDark ? "#4A3E34" : "#C0B09A";

  return (
    <>
      {/* Slide-up / slide-down animation */}
      <style>{`
        @keyframes curtisSlideUp {
          from { transform: translateY(110%); }
          to   { transform: translateY(0); }
        }
        @keyframes curtisSlideDown {
          from { transform: translateY(0); }
          to   { transform: translateY(110%); }
        }
        .curtis-install-prompt {
          animation: curtisSlideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .curtis-install-prompt.hiding {
          animation: curtisSlideDown 0.28s ease-in forwards;
        }
      `}</style>

      <div
        role="banner"
        aria-live="polite"
        className={`curtis-install-prompt${!visible ? " hiding" : ""}`}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          padding: "0 12px",
          // Respect iPhone home-bar safe area
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div
          style={{
            background:   bg,
            border:       `1.5px solid ${cardBorder}`,
            borderRadius: 20,
            padding:      "16px 16px 18px",
            boxShadow:    isDark
              ? "0 -8px 48px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.04) inset"
              : "0 -8px 40px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.9) inset",
            display:     "flex",
            alignItems:  "flex-start",
            gap:         14,
          }}
        >
          <AppIcon />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Heading row */}
            <div
              style={{
                display:        "flex",
                justifyContent: "space-between",
                alignItems:     "flex-start",
                gap:            8,
                marginBottom:   5,
              }}
            >
              <div
                style={{
                  fontFamily:    "'Playfair Display', Georgia, serif",
                  fontSize:      15,
                  fontWeight:    900,
                  letterSpacing: "-0.01em",
                  color:         heading,
                  lineHeight:    1.25,
                }}
              >
                Add CURTIS to your home screen
              </div>
              <button
                onClick={dismiss}
                aria-label="Dismiss install prompt"
                style={{
                  background: "none",
                  border:     "none",
                  cursor:     "pointer",
                  padding:    "0 2px",
                  color:      closeColor,
                  fontSize:   17,
                  lineHeight: 1,
                  flexShrink: 0,
                  marginTop:  1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body copy */}
            {platform === "ios" ? (
              <p
                style={{
                  fontFamily:   "'DM Sans', system-ui, sans-serif",
                  fontSize:     13,
                  lineHeight:   1.55,
                  color:        body,
                  margin:       "0 0 0 0",
                }}
              >
                In Safari, tap the
                <IosShareIcon />
                share button then select{" "}
                <strong style={{ color: heading, fontWeight: 600 }}>
                  &ldquo;Add to Home Screen&rdquo;
                </strong>{" "}
                to install CURTIS.
              </p>
            ) : (
              <>
                <p
                  style={{
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontSize:   13,
                    lineHeight: 1.55,
                    color:      body,
                    margin:     "0 0 12px 0",
                  }}
                >
                  Install for the best experience — works offline and launches instantly.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={install}
                    style={{
                      background:     "linear-gradient(135deg, #FF5A1F, #E8400A)",
                      color:          "white",
                      border:         "none",
                      borderRadius:   8,
                      padding:        "8px 18px",
                      fontFamily:     "'DM Mono', monospace",
                      fontSize:       10,
                      fontWeight:     600,
                      letterSpacing:  "0.07em",
                      textTransform:  "uppercase",
                      cursor:         "pointer",
                      boxShadow:      "0 2px 8px rgba(255,90,31,0.35)",
                      flexShrink:     0,
                    }}
                  >
                    Install App
                  </button>
                  <button
                    onClick={dismiss}
                    style={{
                      background:    "none",
                      border:        `1px solid ${btnBorder}`,
                      borderRadius:  8,
                      padding:       "8px 14px",
                      fontFamily:    "'DM Mono', monospace",
                      fontSize:      10,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      cursor:        "pointer",
                      color:         dimBtn,
                      flexShrink:    0,
                    }}
                  >
                    Not now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
