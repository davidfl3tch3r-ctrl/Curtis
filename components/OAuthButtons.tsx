"use client";

import { createClient } from "@/lib/supabase";
import { useTheme } from "@/lib/theme-context";

// ─── SVG LOGOS ────────────────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.03 17.64 11.72 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleLogo({ color }: { color: string }) {
  return (
    <svg width="16" height="19" viewBox="0 0 170 200" fill={color} xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.197-2.12-9.973-3.17-14.34-3.17-4.58 0-9.492 1.05-14.746 3.17-5.262 2.13-9.501 3.24-12.742 3.35-4.929.21-9.842-1.96-14.746-6.52-3.13-2.73-7.045-7.41-11.735-14.04-5.032-7.08-9.169-15.29-12.41-24.65-3.471-10.11-5.211-19.9-5.211-29.38 0-10.857 2.346-20.221 7.045-28.068 3.693-6.303 8.606-11.275 14.755-14.925 6.149-3.65 12.793-5.51 19.948-5.629 3.915 0 9.049 1.211 15.427 3.591 6.36 2.388 10.447 3.599 12.238 3.599 1.339 0 5.877-1.416 13.57-4.239 7.275-2.618 13.415-3.702 18.445-3.275 13.63 1.1 23.87 6.473 30.68 16.153-12.19 7.386-18.22 17.731-18.1 31.002.11 10.337 3.86 18.939 11.23 25.769 3.34 3.17 7.07 5.62 11.22 7.36-.9 2.61-1.85 5.11-2.86 7.51zM119.11 7.24c0 8.102-2.96 15.667-8.86 22.669-7.12 8.324-15.732 13.134-25.071 12.375a25.222 25.222 0 0 1-.188-3.07c0-7.778 3.386-16.102 9.399-22.908 3.002-3.446 6.82-6.311 11.45-8.597 4.62-2.252 8.99-3.497 13.1-3.71.12 1.017.17 2.035.17 3.241z"/>
    </svg>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function OAuthButtons() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  async function handleOAuth(provider: "google" | "apple") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
  }

  // Google: white (light) / dark-elevated (dark), always bordered
  const googleStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: isDark ? "var(--c-bg-elevated)" : "#FFFFFF",
    border: "1px solid var(--c-border-strong)",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--c-text)",
    transition: "box-shadow 0.15s, border-color 0.15s",
  };

  // Apple: black (light) / white (dark) — flip for visibility on each bg
  const appleStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: isDark ? "#F5F0E8" : "#000000",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "15px",
    fontWeight: 500,
    color: isDark ? "#000000" : "#FFFFFF",
    transition: "opacity 0.15s",
  };

  return (
    <div>
      {/* OAuth buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          style={googleStyle}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--c-text-muted)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 6px rgba(0,0,0,0.08)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--c-border-strong)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
        >
          <GoogleLogo />
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => handleOAuth("apple")}
          style={appleStyle}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.87"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          <AppleLogo color={isDark ? "#000000" : "#FFFFFF"} />
          Continue with Apple
        </button>
      </div>

      {/* Divider */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{ flex: 1, height: 1, background: "var(--c-border-strong)" }} />
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--c-text-dim)",
        }}>
          or
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--c-border-strong)" }} />
      </div>
    </div>
  );
}
