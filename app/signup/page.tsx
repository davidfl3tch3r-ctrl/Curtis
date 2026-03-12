"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.session) {
      // Email confirmation disabled — logged in immediately
      // Update the profile row (auto-created by trigger) with chosen username
      if (username.trim()) {
        await supabase
          .from("profiles")
          .update({ username: username.trim() })
          .eq("id", data.session.user.id);
      }
      router.push("/");
      router.refresh();
    } else {
      // Email confirmation required
      setConfirmEmail(true);
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "15px",
    color: "#1C1410",
    background: "#FAF7F2",
    border: "1px solid #E8E0D8",
    borderRadius: "8px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "'DM Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#9C8A7A",
    marginBottom: "8px",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FAF7F2",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "36px",
            fontWeight: 900,
            letterSpacing: "0.08em",
            color: "#1C1410",
          }}>
            CURTIS
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: "11px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#9C8A7A",
            marginTop: "6px",
          }}>
            Draft Football
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          padding: "36px",
          border: "1px solid #E8E0D8",
        }}>
          {confirmEmail ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "16px" }}>✉️</div>
              <h1 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "22px",
                fontWeight: 700,
                color: "#1C1410",
                margin: "0 0 12px 0",
              }}>
                Check your email
              </h1>
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                color: "#9C8A7A",
                lineHeight: 1.6,
                margin: 0,
              }}>
                We sent a confirmation link to <strong style={{ color: "#1C1410" }}>{email}</strong>. Click it to activate your account.
              </p>
            </div>
          ) : (
            <>
              <h1 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "24px",
                fontWeight: 700,
                color: "#1C1410",
                margin: "0 0 28px 0",
              }}>
                Create account
              </h1>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="e.g. gaffer_dan"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#FF5A1F")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E0D8")}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#FF5A1F")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E0D8")}
                  />
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#FF5A1F")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E0D8")}
                  />
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "10px",
                    color: "#B8A898",
                    marginTop: "6px",
                    letterSpacing: "0.05em",
                  }}>
                    Minimum 6 characters
                  </div>
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
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </form>
            </>
          )}
        </div>

        {!confirmEmail && (
          <p style={{
            textAlign: "center",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            color: "#9C8A7A",
            marginTop: "20px",
          }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#FF5A1F", textDecoration: "none", fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
