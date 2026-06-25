import type { Metadata } from "next";
import "./globals.css";
import AppNav from "@/components/AppNav";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "Polman Meeting Web Attendance",
  description: "Absensi rapat berbasis wajah via web"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body><ToastProvider><AppNav />{children}</ToastProvider></body>
    </html>
  );
}
