/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Noto Serif TC"', 'serif'],
        body: ['"Noto Sans TC"', '"Microsoft JhengHei"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f7f6f3',
          100: '#eae8e0',
          200: '#d5d0c4',
          300: '#b8b0a0',
          400: '#9a8f7c',
          500: '#7d7264',
          600: '#635a4e',
          700: '#4a4339',
          800: '#332e27',
          900: '#1c1a16',
          950: '#0e0d0b',
        },
        vermillion: {
          DEFAULT: '#c23616',
          light: '#e74c3c',
          dark: '#8b2510',
        },
        gold: {
          DEFAULT: '#c8a45a',
          light: '#e8cc7a',
          dark: '#a07830',
        },
      },
    },
  },
  plugins: [],
};
