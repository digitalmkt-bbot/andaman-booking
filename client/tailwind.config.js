/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Primary blue (reference #4f86f7 family)
        brand: {
          50: '#eef4ff',
          100: '#e0edff',
          200: '#c7dbff',
          300: '#a5c4fb',
          400: '#7ca5f5',
          500: '#4f86f7',
          600: '#2563eb',
          700: '#1d4fd7',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Dark sidebar / surfaces
        ink: {
          900: '#0b0d10',
          850: '#12151b',
          800: '#16181d',
          750: '#1f232c',
          700: '#20242e',
          600: '#2a2e39',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['Prompt', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
