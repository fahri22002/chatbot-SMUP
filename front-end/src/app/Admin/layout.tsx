// Admin/layout.tsx
'use client'
import { ThemeProvider } from './theme-provider' // Sesuaikan path import jika perlu

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // Jangan gunakan html/body di sini karena ini sub-layout
    <ThemeProvider attribute="class" defaultTheme="light">
      {children}
    </ThemeProvider>
  )
}