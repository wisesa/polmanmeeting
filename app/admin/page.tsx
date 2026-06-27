import { requireAdminSession } from "@/lib/auth/admin-session";
import Link from "next/link";
import { getInvitationForms, getMasterProdi, getMeetings, getRegisteredFaces } from "@/lib/firebase/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  await requireAdminSession("/admin");
  const [faces, prodi, invitations, meetings] = await Promise.all([
    getRegisteredFaces(),
    getMasterProdi(true),
    getInvitationForms(),
    getMeetings(),
  ]);

  const activeMeetings = meetings.filter((meeting) => (meeting.status || "active") !== "closed");

  const menus = [
    {
      href: "/admin/register-wajah",
      icon: "🙂",
      title: "Data Wajah",
      description: "Daftarkan wajah peserta dengan kamera atau file foto.",
      metric: `${faces.length} wajah`,
    },
    {
      href: "/admin/prodi",
      icon: "🏫",
      title: "Master Prodi",
      description: "Kelola pilihan program studi untuk data wajah, undangan, dan meeting.",
      metric: `${prodi.length} prodi`,
    },
    {
      href: "/admin/undangan",
      icon: "✉️",
      title: "Undangan",
      description: "Buat undangan rapat, simpan agenda, peserta undangan, tempat, dan jadwal.",
      metric: `${invitations.length} undangan`,
    },
    {
      href: "/admin/meeting",
      icon: "📝",
      title: "Meeting",
      description: "Buat meeting langsung, jalankan rapat, isi hasil rapat, dan tutup meeting.",
      metric: `${activeMeetings.length} aktif`,
    },
  ];

  return (
    <main className="appShell">
      <section className="heroPanel adminHero">
        <div className="heroGlow" />
        <div className="heroContent">
          <div>
            <p className="eyebrow light">Panel Admin</p>
            <h1 className="heroTitle">Kelola Meeting</h1>
            <p className="heroSubtitle">
              Admin mengelola data wajah peserta, undangan, dan meeting. Dosen masuk menggunakan pengenalan wajah.
            </p>
          </div>
          <div className="heroMetric">
            <strong>{meetings.length}</strong>
            <span>Total meeting</span>
          </div>
        </div>
      </section>

      <section className="adminMenuGrid">
        {menus.map((menu) => (
          <Link key={menu.href} href={menu.href} className="adminMenuCard">
            <div className="adminMenuIcon">{menu.icon}</div>
            <div>
              <div className="cardTopline">
                <h2>{menu.title}</h2>
                <span className="counterPill">{menu.metric}</span>
              </div>
              <p className="muted">{menu.description}</p>
            </div>
            <span className="adminMenuArrow">Buka →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
