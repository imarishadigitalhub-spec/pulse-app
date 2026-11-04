/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0B',
        surface: '#141416',
        surface2: '#1C1C1F',
        primary: '#3B82F6'
      }
    }
  },
  plugins: []
};
