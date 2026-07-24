/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e6f1fb',
          100: '#b5d4f4',
          400: '#4a90d4',
          500: '#185FA5',
          600: '#0c447c',
          700: '#093660',
        },
      },
    },
  },
  plugins: [],
};
