/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tatkal: {
          orange: '#ff6600',
          blue: '#003366',
          dark: '#0b0f19'
        }
      }
    },
  },
  plugins: [],
}

