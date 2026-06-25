"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirebaseClientAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { useToast } from "@/components/ToastProvider";

type AdminLoginClientProps = {
  nextPath?: string;
};

type LoginState = {
  status: "idle" | "loading" | "error";
  message: string;
};

function safeNextPath(value?: string) {
  if (!value) return "/admin";
  if (!value.startsWith("/admin")) return "/admin";
  if (value.startsWith("/admin/login")) return "/admin";
  return value;
}

export default function AdminLoginClient({ nextPath }: AdminLoginClientProps) {
  const [state, setState] = useState<LoginState>({ status: "idle", message: "" });
  const toast = useToast();
  const redirectTarget = useMemo(() => safeNextPath(nextPath), [nextPath]);
  const isLoading = state.status === "loading";

  useEffect(() => {
    if (!state.message || state.status !== "error") return;
    toast.error("Login admin gagal", state.message);
  }, [state.message, state.status, toast]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setState({ status: "loading", message: "Memeriksa akun admin..." });

      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");

      if (!email || !password) {
        throw new Error("Email dan password wajib diisi.");
      }

      if (!isFirebaseClientConfigured) {
        throw new Error("Konfigurasi Firebase Web App belum lengkap. Isi NEXT_PUBLIC_FIREBASE_API_KEY dan NEXT_PUBLIC_FIREBASE_APP_ID di .env.local.");
      }

      const firebaseClientAuth = getFirebaseClientAuth();
      const credential = await signInWithEmailAndPassword(firebaseClientAuth, email, password);
      const idToken = await credential.user.getIdToken(true);

      const response = await fetch("/api/auth/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        await signOut(firebaseClientAuth).catch(() => undefined);
        throw new Error(data.message || "Login admin gagal.");
      }

      window.location.href = redirectTarget;
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Login admin gagal.",
      });
    }
  }

  return (
    <main className="appShell authShell">
      <section className="authCard">
        <div className="authHeader">
          <p className="eyebrow">Admin Login</p>
          <h1>Masuk Panel Admin</h1>
          <p className="muted">Gunakan akun yang sudah dibuat di Firebase Authentication.</p>
        </div>

        <form className="modernForm" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input name="email" type="email" placeholder="admin@kampus.ac.id" autoComplete="email" required />
          </label>

          <label>
            <span>Password</span>
            <input name="password" type="password" placeholder="Password Firebase Auth" autoComplete="current-password" required />
          </label>

          <button type="submit" className="primaryButton" disabled={isLoading}>
            {isLoading ? "Masuk..." : "Login Admin"}
          </button>
        </form>


        <div className="authFooter">
          <a href="/" className="ghostButton small">Kembali ke mode user</a>
        </div>
      </section>
    </main>
  );
}
