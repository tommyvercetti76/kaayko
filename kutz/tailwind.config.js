/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        bg: '#020617',
        card: '#0a0f1a',
        border: '#1e293b',
        'text-primary': '#e2e8f0',
        'text-secondary': '#64748b',
        'text-muted': '#475569',
        green: '#34d399',
        amber: '#f59e0b',
        blue: '#38bdf8',
        red: '#f87171',
        purple: '#818cf8',
        pink: '#f472b6',
      },
    },
  },
  plugins: [],
};
