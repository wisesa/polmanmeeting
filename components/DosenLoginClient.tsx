"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirebaseClientAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { useToast } from "@/components/ToastProvider";

type DosenLoginClientProps = {
  nextPath?: string;
};

type LoginState = {
  status: "idle" | "loading" | "error";
  message: string;
};

function safeNextPath(value?: string) {
  if (!value) return "/dosen/register-wajah";
  if (!value.startsWith("/dosen")) return "/dosen/register-wajah";
  if (value.startsWith("/dosen/login")) return "/dosen/register-wajah";
  return value;
}

export default function DosenLoginClient({ nextPath }: DosenLoginClientProps) {
  const [state, setState] = useState<LoginState>({ status: "idle", message: "" });
  const toast = useToast();
  const redirectTarget = useMemo(() => safeNextPath(nextPath), [nextPath]);
  const isLoading = state.status === "loading";

  useEffect(() => {
    if (!state.message || state.status !== "error") return;
    toast.error("Login dosen gagal", state.message);
  }, [state.message, state.status, toast]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setState({ status: "loading", message: "Memeriksa akun dosen..." });

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

      const response = await fetch("/api/auth/dosen/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        await signOut(firebaseClientAuth).catch(() => undefined);
        throw new Error(data.message || "Login dosen gagal.");
      }

      window.location.href = redirectTarget;
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Login dosen gagal.",
      });
    }
  }

  return (
    <main className="appShell authShell">
      <section className="authCard">
        <div className="authHeader">
          <p className="eyebrow">Dosen Login</p>
          <h1>Masuk Register Wajah</h1>
          <p className="muted">Akun dosen hanya dapat membuka halaman register wajah.</p>
        </div>

        <form className="modernForm" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              name="email"
              type="email"
              placeholder="dosen@polman-babel.ac.id"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input name="password" type="password" placeholder="Password Firebase Auth" autoComplete="current-password" required />
          </label>

          <button type="submit" className="primaryButton" disabled={isLoading}>
            {isLoading ? "Masuk..." : "Login Dosen"}
          </button>
        </form>


        <div className="authFooter">
          <a href="/" className="ghostButton small">Kembali ke mode user</a>
        </div>
      </section>
    </main>
  );
}
