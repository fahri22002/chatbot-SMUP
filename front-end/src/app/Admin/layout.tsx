// src/app/Admin/layout.tsx
import React from 'react';

// Hapus semua impor Metadata, Inter, dan ThemeProvider.
// Layout ini sudah dibungkus oleh root layout (src/app/layout.tsx)
// dan ThemeProvider-nya.

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
