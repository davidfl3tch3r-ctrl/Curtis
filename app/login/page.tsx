"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OAuthButtons } from "@/components/OAuthButtons";
import { useIsMobile } from "@/lib/use-is-mobile";

export default function LoginPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--c-bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
    }}>
      <div style={{ position: "absolute", top: 16, right: 16 }}><ThemeToggle /></div>
      <div style={{ width: "100%", maxWidth: "400px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: isMobile ? "28px" : "36px",
              fontWeight: 900,
              letterSpacing: "0.08em",
              color: "var(--c-text)",
            }}>
              CURTIS
            </div>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--c-text-muted)",
              marginTop: "6px",
            }}>
              Draft Football
            </div>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--c-bg-elevated)",
          borderRadius: "12px",
          padding: isMobile ? "24px 20px" : "36px",
          border: "1px solid var(--c-border-strong)",
        }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--c-text)",
            margin: "0 0 24px 0",
          }}>
            Sign in
          </h1>

          <OAuthButtons />

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{
                display: "block",
                fontFamily: "'DM Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--c-text-muted)",
                marginBottom: "8px",
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "15px",
                  color: "var(--c-text)",
                  background: "var(--c-input)",
                  border: "1px solid var(--c-input-border)",
                  borderRadius: "8px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#FF5A1F")}
                onBlur={(e) => (e.target.style.borderColor = "var(--c-input-border)")}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                fontFamily: "'DM Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--c-text-muted)",
                marginBottom: "8px",
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "15px",
                  color: "var(--c-text)",
                  background: "var(--c-input)",
                  border: "1px solid var(--c-input-border)",
                  borderRadius: "8px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#FF5A1F")}
                onBlur={(e) => (e.target.style.borderColor = "var(--c-input-border)")}
              />
            </div>

            {error && (
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                color: "#C0392B",
                background: "#FDF2F2",
                border: "1px solid #F5C6C6",
                borderRadius: "6px",
                padding: "10px 12px",
                marginBottom: "16px",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: loading ? "#E8A88A" : "#FF5A1F",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "15px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                minHeight: 44,
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: "center",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "14px",
          color: "var(--c-text-muted)",
          marginTop: "20px",
        }}>
          No account?{" "}
          <Link href="/signup" style={{ color: "#FF5A1F", textDecoration: "none", fontWeight: 500 }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
