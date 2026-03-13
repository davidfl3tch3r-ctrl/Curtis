"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function AvatarMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [initials, setInitials] = useState("?");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, role")
        .eq("id", user.id)
        .single();
      if (profile?.role === "admin" || profile?.role === "moderator") setIsAdmin(true);
      const rawName = profile?.username
        ? profile.username
        : (user.email ?? "").split("@")[0].replace(/[._-]/g, " ");
      setDisplayName(rawName.charAt(0).toUpperCase() + rawName.slice(1));
      setInitials(rawName.slice(0, 2).toUpperCase());
    }
    load();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function signOut() {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const menuItems = [
    { label: "My Profile", href: "/profile" },
    { label: "My Badges", href: "/profile#badges" },
    { label: "Settings", href: "/settings" },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .avatar-menu-item {
          display: flex;
          align-items: center;
          padding: 11px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          color: var(--c-text);
          text-decoration: none;
          transition: background 0.12s;
          cursor: pointer;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
        }
        .avatar-menu-item:hover { background: var(--c-row); }
      `}</style>

      {/* Avatar button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open account menu"
        aria-expanded={open}
        style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, #FF5A1F, #E8400A)",
          border: open ? "2px solid rgba(255,90,31,0.5)" : "2px solid transparent",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'DM Mono', monospace", fontSize: 12, color: "white",
          minWidth: 34, minHeight: 34,
          transition: "border-color 0.15s",
        }}
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: 42, right: 0,
          width: 224,
          background: "var(--c-bg-elevated)",
          border: "1.5px solid var(--c-border-strong)",
          borderRadius: 13,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          zIndex: 400,
          overflow: "hidden",
          animation: "dropdownFadeIn 0.14s ease",
        }}>
          {/* User info header */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--c-border)" }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--c-text)", marginBottom: 3 }}>
              {displayName}
            </p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--c-text-muted)", letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email}
            </p>
          </div>

          {/* Navigation items */}
          {menuItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="avatar-menu-item"
            >
              {item.label}
            </Link>
          ))}

          {/* Admin Panel link (admin/moderator only) */}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="avatar-menu-item"
              style={{ color: "#FF5A1F", gap: 8 }}
            >
              <span style={{ fontSize: 14 }}>⚙️</span>
              Admin Panel
            </Link>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: "var(--c-border)", margin: "2px 0" }} />

          {/* Sign out */}
          <button
            onClick={signOut}
            className="avatar-menu-item"
            style={{ color: "#DC2626" }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
