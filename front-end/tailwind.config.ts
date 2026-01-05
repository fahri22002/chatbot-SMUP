import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', 
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './Admin/**/*.{js,ts,jsx,tsx}', 
    './chatbot/**/*.{js,ts,jsx,tsx}', 
  ],
  theme: {
    extend: {
      colors: {
        // Menghubungkan variabel CSS --background & --foreground
        background: 'var(--background)',
        foreground: 'var(--foreground)',

        // Palette Warna UNPAD (Sesuai globals.css)
        // Sekarang kamu bisa pakai class: bg-unpad-gold, text-unpad-navy, dll.
        unpad: {
          gold: '#FFC700',   
          black: '#111111',  
          DarkYellow: '#F9A129',
          navy: '#1E3A8A',   
          cream: '#FEF5D4',  
          slate: '#2C2E31',  
        },
      },
    },
  },
  plugins: [
    // Plugin ini WAJIB agar format text (Markdown) di chat rapi
  ],
}

export default config