/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#F0F4F8',
          100: '#D9E2EC',
          200: '#BCCCDC',
          300: '#9FB3C8',
          400: '#829AB1',
          500: '#627D98',
          600: '#486581',
          700: '#334E68',
          800: '#1E2A38',
          900: '#0B192C',
          950: '#070F1C',
        },
        cream: {
          50: '#FDFBF7',
          100: '#F7F4EC',
          200: '#EDE8DD',
          300: '#DFD7C7',
          400: '#C2B8A3',
        },
        accent: {
          blue: '#1D4ED8',
          crimson: '#991B1B',
          amber: '#B45309',
          emerald: '#047857',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
