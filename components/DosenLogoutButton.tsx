"use client";

import { useState } from "react";

export default function DosenLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    try {
      setLoading(true);
      await fetch("/api/auth/dosen/session", { method: "DELETE" });
      window.location.href = "/dosen/login";
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
