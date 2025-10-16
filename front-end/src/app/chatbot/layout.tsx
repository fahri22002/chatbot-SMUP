import type { Metadata } from "next";
// Perubahan: Impor font Inter dari next/font/google
import { Inter } from "next/font/google";
import "./globals.css";

// Perubahan: Inisialisasi font
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chatbot Kampus",
  description: "Asisten Akademik Virtual",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Perubahan: Terapkan class font ke body */}
      <body className={inter.className}>{children}</body>
    </html>
  );
}