import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // Ini adalah kunci untuk next-themes
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './Admin/**/*.{js,ts,jsx,tsx}', // Pastikan ini mengarah ke folder Admin Anda
    './chatbot/**/*.{js,ts,jsx,tsx}', // Dan folder chatbot
  ],
  theme: {
    extend: {
      colors: {
        // Warna kustom Anda
        'theme-dark': '#2a2a2a', // Warna dark utama Anda
        'theme-light-gray': '#D3D3D3', // Warna light sekunder Anda
        
        // Palet warna yang lebih baik untuk tema
        dark: {
          100: '#1a1a1a', // Background utama
          200: '#2a2a2a', // Background sekunder (warna Anda)
          300: '#3c3c3c', // Border / Aksen
          400: '#555555', // Hover
        },
        light: {
          100: '#FFFFFF', // Background utama
          200: '#F5F5F7', // Background sekunder
          300: '#E8E8ED', // Border
          400: '#D3D3D3', // Aksen (warna Anda)
        }
      },
    },
  },
  plugins: [],
}

export default config