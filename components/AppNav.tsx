"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import DosenLogoutButton from "@/components/DosenLogoutButton";

const adminMenuItems = [
  { href: "/admin/register-wajah", label: "Register Face", icon: "🙂" },
  { href: "/admin/prodi", label: "Master Prodi", icon: "🏫" },
  { href: "/admin/undangan", label: "Undangan", icon: "✉️" },
  { href: "/admin/meeting", label: "Meeting", icon: "🗓️" },
];

export default function AppNav() {
  const pathname = usePathname();
  const isAdminArea = pathname?.startsWith("/admin");
  const isDosenArea = pathname?.startsWith("/dosen");
  const brandHref = isAdminArea ? "/admin" : isDosenArea ? "/dosen/register-wajah" : "/";
  const brandTitle = isAdminArea ? "Admin Meeting" : isDosenArea ? "Dosen Register" : "Polman Meeting";

  return (
    <nav className="appNav" aria-label="Menu utama">
      <Link href={brandHref} className="brandPill" title={brandTitle}>
        <span className="navIcon brandIcon" aria-hidden="true">●</span>
        <span className="navText">{brandTitle}</span>
      </Link>

      <div className="navLinks">
        {isAdminArea ? (
          <>
            <Link href="/" className="navLink mutedNav" title="Mode User">
              <span className="navIcon" aria-hidden="true">👤</span>
              <span className="navText">Mode User</span>
            </Link>
            {adminMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? "navLink activeNav" : "navLink"}
                title={item.label}
              >
                <span className="navIcon" aria-hidden="true">{item.icon}</span>
                <span className="navText">{item.label}</span>
              </Link>
            ))}
            {pathname !== "/admin/login" ? <AdminLogoutButton /> : null}
          </>
        ) : isDosenArea ? (
          <>
            <Link href="/" className="navLink mutedNav" title="Mode User">
              <span className="navIcon" aria-hidden="true">👤</span>
              <span className="navText">Mode User</span>
            </Link>
            <Link
              href="/dosen/register-wajah"
              className={pathname === "/dosen/register-wajah" ? "navLink activeNav" : "navLink"}
              title="Register Wajah"
            >
              <span className="navIcon" aria-hidden="true">🙂</span>
              <span className="navText">Register Wajah</span>
            </Link>
            {pathname !== "/dosen/login" ? <DosenLogoutButton /> : null}
          </>
        ) : (
          <Link href="/" className="navLink activeNav" title="Daftar Meeting">
            <span className="navIcon" aria-hidden="true">📋</span>
            <span className="navText">Daftar Meeting</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
