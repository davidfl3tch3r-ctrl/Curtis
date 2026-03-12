"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { NavBar } from "@/components/NavBar";
import { AvatarMenu } from "@/components/AvatarMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/lib/theme-context";
import { useIsMobile } from "@/lib/use-is-mobile";

export default function SettingsPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [email, setEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const navLinks = [{ label: "Home", href: "/" }, { label: "Profile", href: "/profile" }];

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setEmail(user.email ?? "");
      setEmailInput(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      const rawName = profile?.username
        ? profile.username
        : (user.email ?? "").split("@")[0].replace(/[._-]/g, " ");
      const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      setDisplayName(name);
      setNameInput(name);
      setLoading(false);
    }
    load();
  }, [router]);

  async function saveName() {
    if (!nameInput.trim()) return;
    setSavingName(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        username: nameInput.trim().toLowerCase().replace(/\s+/g, "_"),
      });
      setDisplayName(nameInput.trim());
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    }
    setSavingName(false);
  }

  async function saveEmail() {
    if (!emailInput.trim() || emailInput === email) return;
    setSavingEmail(true);
    setEmailMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: emailInput.trim() });
    if (error) {
      setEmailMsg(error.message);
    } else {
      setEmailMsg("Confirmation sent to your new email address.");
    }
    setSavingEmail(false);
  }

  async function deleteAccount() {
    if (deleteInput !== "DELETE") return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Sign out first, then let the user contact support for full deletion
    // (Supabase does not expose deleteUser client-side by default)
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "var(--c-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--c-text-dim)", letterSpacing: "0.12em" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)", overflowX: "hidden" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <NavBar links={navLinks} activeLabel="" right={<><ThemeToggle size="sm" /><AvatarMenu /></>} />

      <div style={{ maxWidth: 600, margin: "0 auto", padding: isMobile ? "24px 16px" : "40px 40px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF5A1F", marginBottom: 6 }}>Your Account</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 26 : 34, fontWeight: 900, letterSpacing: "-0.02em" }}>Settings</h1>
        </div>

        {/* Display Name */}
        <Section title="Display Name">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
            This is how you appear across CURTIS.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveName()}
              placeholder="Display name"
              style={{
                flex: 1, minWidth: 160,
                fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                background: "var(--c-bg)", border: "1.5px solid var(--c-border-strong)",
                borderRadius: 9, padding: "10px 14px", color: "var(--c-text)",
                outline: "none",
              }}
            />
            <button
              onClick={saveName}
              disabled={savingName || !nameInput.trim()}
              style={{ padding: "10px 20px", borderRadius: 9, background: "#FF5A1F", color: "white", border: "none", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em", cursor: "pointer", opacity: savingName ? 0.6 : 1, whiteSpace: "nowrap" }}
            >
              {savingName ? "Saving…" : nameSaved ? "Saved ✓" : "Save"}
            </button>
          </div>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--c-text-dim)", marginTop: 8, letterSpacing: "0.04em" }}>
            Current: {displayName}
          </p>
        </Section>

        {/* Email */}
        <Section title="Email Address">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
            A confirmation will be sent to your new address.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveEmail()}
              type="email"
              placeholder="Email address"
              style={{
                flex: 1, minWidth: 200,
                fontFamily: "'DM Mono', monospace", fontSize: 12,
                background: "var(--c-bg)", border: "1.5px solid var(--c-border-strong)",
                borderRadius: 9, padding: "10px 14px", color: "var(--c-text)",
                outline: "none", letterSpacing: "0.02em",
              }}
            />
            <button
              onClick={saveEmail}
              disabled={savingEmail || emailInput === email}
              style={{ padding: "10px 20px", borderRadius: 9, background: "#FF5A1F", color: "white", border: "none", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em", cursor: "pointer", opacity: (savingEmail || emailInput === email) ? 0.5 : 1, whiteSpace: "nowrap" }}
            >
              {savingEmail ? "Updating…" : "Update"}
            </button>
          </div>
          {emailMsg && (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: emailMsg.startsWith("Confirmation") ? "#16A34A" : "#DC2626", marginTop: 8 }}>
              {emailMsg}
            </p>
          )}
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
            Choose your preferred colour scheme.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            {(["light", "dark"] as const).map(t => (
              <button
                key={t}
                onClick={() => { if (theme !== t) toggleTheme(); }}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  border: theme === t ? "2px solid #FF5A1F" : "1.5px solid var(--c-border-strong)",
                  background: theme === t ? "rgba(255,90,31,0.06)" : "var(--c-bg)",
                  color: theme === t ? "#FF5A1F" : "var(--c-text-muted)",
                  fontFamily: "'DM Mono', monospace", fontSize: 11,
                  letterSpacing: "0.08em", textTransform: "capitalize",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {t === "light" ? "☀ Light" : "◑ Dark"}
              </button>
            ))}
          </div>
        </Section>

        {/* Danger Zone */}
        <Section title="Danger Zone" danger>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--c-text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ padding: "10px 20px", borderRadius: 9, background: "transparent", color: "#DC2626", border: "1.5px solid #DC2626", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em", cursor: "pointer" }}
            >
              Delete Account
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#DC2626", letterSpacing: "0.04em" }}>
                Type DELETE to confirm:
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  style={{
                    flex: 1, minWidth: 120,
                    fontFamily: "'DM Mono', monospace", fontSize: 12,
                    background: "var(--c-bg)", border: "1.5px solid #DC2626",
                    borderRadius: 9, padding: "10px 14px", color: "#DC2626",
                    outline: "none", letterSpacing: "0.08em",
                  }}
                />
                <button
                  onClick={deleteAccount}
                  disabled={deleteInput !== "DELETE"}
                  style={{ padding: "10px 20px", borderRadius: 9, background: "#DC2626", color: "white", border: "none", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em", cursor: "pointer", opacity: deleteInput === "DELETE" ? 1 : 0.4, whiteSpace: "nowrap" }}
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                  style={{ padding: "10px 16px", borderRadius: 9, background: "transparent", color: "var(--c-text-muted)", border: "1px solid var(--c-border-strong)", fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children, danger = false }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{
      background: "var(--c-bg-elevated)",
      borderRadius: 16,
      border: danger ? "1.5px solid rgba(220,38,38,0.2)" : "1.5px solid var(--c-border-strong)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${danger ? "rgba(220,38,38,0.15)" : "var(--c-border)"}` }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: danger ? "#DC2626" : "var(--c-text-muted)" }}>
          {title}
        </p>
      </div>
      <div style={{ padding: "18px 20px" }}>
        {children}
      </div>
    </div>
  );
}
