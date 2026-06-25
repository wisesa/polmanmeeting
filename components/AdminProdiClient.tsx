"use client";

import { FormEvent, useEffect, useState } from "react";
import type { MasterProdi } from "@/lib/firebase/schema";
import { useToast } from "@/components/ToastProvider";

type AdminProdiClientProps = {
  initialProdi: MasterProdi[];
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getBool(formData: FormData, key: string) {
  return String(formData.get(key) || "true") === "true";
}

function formatDate(value?: number | object) {
  if (!value || typeof value !== "number") return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AdminProdiClient({ initialProdi }: AdminProdiClientProps) {
  const [items, setItems] = useState(initialProdi);
  const [editing, setEditing] = useState<MasterProdi | null>(null);
  const [deletingId, setDeletingId] = useState("");
  const [state, setState] = useState<SaveState>({ status: "idle", message: "" });
  const toast = useToast();

  useEffect(() => {
    if (!state.message) return;

    if (state.status === "success") {
      toast.success("Berhasil", state.message);
    }

    if (state.status === "error") {
      toast.error("Gagal", state.message);
    }
  }, [state.message, state.status, toast]);
  const isSaving = state.status === "saving";
  const formKey = editing?.prodiId || "new-prodi";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    try {
      setState({ status: "saving", message: editing ? "Memperbarui master prodi..." : "Menyimpan master prodi..." });
      const formData = new FormData(formElement);
      const payload = {
        prodiId: getString(formData, "prodiId"),
        kode: getString(formData, "kode"),
        nama: getString(formData, "nama"),
        jenjang: getString(formData, "jenjang"),
        jurusan: getString(formData, "jurusan"),
        isActive: getBool(formData, "isActive"),
      };

      const url = editing ? `/api/master-prodi/${encodeURIComponent(editing.prodiId)}` : "/api/master-prodi";
      const method = editing ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Master prodi gagal disimpan.");
      }

      if (editing) {
        setItems((current) => current.map((item) => item.prodiId === editing.prodiId ? data.prodi : item).sort((a, b) => a.displayName.localeCompare(b.displayName, "id-ID")));
        setState({ status: "success", message: "Master prodi berhasil diperbarui." });
      } else {
        setItems((current) => [data.prodi, ...current].sort((a, b) => a.displayName.localeCompare(b.displayName, "id-ID")));
        setState({ status: "success", message: "Master prodi berhasil disimpan." });
      }

      formElement.reset();
      setEditing(null);
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Master prodi gagal disimpan." });
    }
  }

  async function deleteItem(prodiId: string) {
    if (!window.confirm("Hapus master prodi ini? Data wajah dan meeting lama tidak ikut dihapus.")) return;

    try {
      setDeletingId(prodiId);
      const response = await fetch(`/api/master-prodi/${encodeURIComponent(prodiId)}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Master prodi gagal dihapus.");
      }

      setItems((current) => current.filter((item) => item.prodiId !== prodiId));
      if (editing?.prodiId === prodiId) setEditing(null);
      setState({ status: "success", message: "Master prodi berhasil dihapus." });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Master prodi gagal dihapus." });
    } finally {
      setDeletingId("");
    }
  }

  return (
    <main className="appShell">
      <section className="heroPanel compactHero">
        <div className="heroGlow" />
        <div className="heroContent">
          <div>
            <p className="eyebrow light">Master Prodi</p>
            <h1 className="heroTitle">Lookup Program Studi</h1>
            <p className="heroSubtitle">
              Data ini muncul sebagai pilihan di register wajah, undangan, dan meeting.
            </p>
          </div>
          <div className="heroMetric">
            <strong>{items.length}</strong>
            <span>Total prodi</span>
          </div>
        </div>
      </section>

      <section className="formPanel adminFormPanel">
        <div className="sectionTitleRow noMargin">
          <div>
            <p className="eyebrow">Form Master</p>
            <h2>{editing ? "Edit Prodi" : "Tambah Prodi"}</h2>
          </div>
          {editing ? <button type="button" className="ghostButton small" onClick={() => setEditing(null)}>Batal Edit</button> : null}
        </div>

        <form key={formKey} className="modernForm" onSubmit={handleSubmit}>
          <div className="formGrid two">
            <label>
              <span>Kode Prodi</span>
              <input name="kode" defaultValue={editing?.kode || ""} placeholder="TI" />
            </label>
            <label>
              <span>Nama Prodi</span>
              <input name="nama" defaultValue={editing?.nama || ""} placeholder="Teknik Informatika" required />
            </label>
          </div>

          <div className="formGrid two">
            <label>
              <span>Jenjang</span>
              <input name="jenjang" defaultValue={editing?.jenjang || ""} placeholder="D3, D4, S1" />
            </label>
            <label>
              <span>Jurusan</span>
              <input name="jurusan" defaultValue={editing?.jurusan || ""} placeholder="Jurusan" />
            </label>
          </div>

          <label>
            <span>Status</span>
            <select name="isActive" defaultValue={editing?.isActive === false ? "false" : "true"}>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </label>

          <input name="prodiId" type="hidden" defaultValue={editing?.prodiId || ""} />

          <button type="submit" className="primaryButton" disabled={isSaving}>
            {isSaving ? "Menyimpan..." : editing ? "Update Prodi" : "Simpan Prodi"}
          </button>
        </form>

      </section>

      <section className="contentSection">
        <div className="sectionTitleRow">
          <div>
            <p className="eyebrow">Daftar Prodi</p>
            <h2>Kelola Master Prodi</h2>
          </div>
          <span className="counterPill">{items.length} data</span>
        </div>

        {items.length === 0 ? (
          <div className="emptyState modernEmpty">
            <div className="emptyIcon">🏫</div>
            <h2>Belum ada master prodi</h2>
            <p className="muted">Tambahkan prodi agar bisa dipakai sebagai lookup di form lain.</p>
          </div>
        ) : (
          <div className="meetingGrid">
            {items.map((item) => (
              <article key={item.prodiId} className="meetingCard staticCard">
                <div className="cardTopline">
                  <span className={item.isActive ? "badge active" : "badge closed"}>{item.isActive ? "Aktif" : "Nonaktif"}</span>
                </div>
                <h3>{item.displayName}</h3>
                <p className="topic">{[item.jenjang, item.jurusan].filter(Boolean).join(" • ") || "Detail prodi belum diisi."}</p>
                <div className="meetingInfoGrid">
                  <div className="infoTile"><span>Kode</span><strong>{item.kode || "-"}</strong></div>
                  <div className="infoTile"><span>ID</span><strong>{item.prodiId}</strong></div>
                  <div className="infoTile full"><span>Update</span><strong>{formatDate(item.updatedAt)}</strong></div>
                </div>
                <div className="meetingCardActions wrapActions">
                  <button type="button" className="ghostButton small" onClick={() => setEditing(item)}>Edit</button>
                  <button type="button" className="dangerButton small" onClick={() => deleteItem(item.prodiId)} disabled={deletingId === item.prodiId}>
                    {deletingId === item.prodiId ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
