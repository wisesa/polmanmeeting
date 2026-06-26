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

const dosenMenuItems = [
  { href: "/dosen/ganti-profil", label: "Ganti Profil", icon: "🙂" },
  { href: "/dosen/meeting", label: "Meeting", icon: "🗓️" },
];

export default function AppNav() {
  const pathname = usePathname();
  const isAdminArea = pathname?.startsWith("/admin");
  const isDosenArea = pathname?.startsWith("/dosen");
  const brandHref = isAdminArea ? "/admin" : isDosenArea ? "/dosen/meeting" : "/dosen/login";
  const brandTitle = isAdminArea ? "Admin Meeting" : isDosenArea ? "Dosen Meeting" : "Polman Meeting";

  return (
    <nav className="appNav" aria-label="Menu utama">
      <Link href={brandHref} className="brandPill" title={brandTitle}>
        <span className="navIcon brandIcon" aria-hidden="true">●</span>
        <span className="navText">{brandTitle}</span>
      </Link>

      <div className="navLinks">
        {isAdminArea ? (
          <>
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
            {dosenMenuItems.map((item) => {
              const active = pathname === item.href || (item.href === "/dosen/meeting" && pathname?.startsWith("/dosen/meeting/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "navLink activeNav" : "navLink"}
                  title={item.label}
                >
                  <span className="navIcon" aria-hidden="true">{item.icon}</span>
                  <span className="navText">{item.label}</span>
                </Link>
              );
            })}
            {pathname !== "/dosen/login" ? <DosenLogoutButton /> : null}
          </>
        ) : (
          <Link href="/dosen/login" className="navLink activeNav" title="Login Dosen">
            <span className="navIcon" aria-hidden="true">🙂</span>
            <span className="navText">Login Dosen</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
