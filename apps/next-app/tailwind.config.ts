/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#f59e0b',
        circuit: {
          dark: '#111827',
          gray: '#1f2937',
          light: '#374151',
        }
      },
    },
  },
  plugins: [],
}
