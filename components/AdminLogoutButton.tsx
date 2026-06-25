"use client";

import { useState } from "react";

export default function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    try {
      setLoading(true);
      await fetch("/api/auth/admin/session", { method: "DELETE" });
      window.location.href = "/admin/login";
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="navLink dangerNav" onClick={logout} disabled={loading} title="Logout">
      <span className="navIcon" aria-hidden="true">🚪</span>
      <span className="navText">{loading ? "Keluar..." : "Logout"}</span>
    </button>
  );
}
