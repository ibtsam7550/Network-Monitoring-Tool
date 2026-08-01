/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#08090b',
          900: '#0d0f12',
          850: '#111318',
          800: '#15181e',
          700: '#1c2028',
          600: '#262b35',
          border: '#20242c',
        },
        ink: {
          100: '#f4f5f7',
          300: '#c7cad1',
          500: '#8b8f99',
          700: '#5a5e68',
        },
        signal: {
          DEFAULT: '#2dd9c7',
          dim: '#1a8f83',
          glow: 'rgba(45, 217, 199, 0.35)',
        },
        down: {
          DEFAULT: '#f0466b',
          dim: '#7a2438',
        },
        warn: {
          DEFAULT: '#f5b942',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"Playfair Display"', 'serif'],
        mono: ['"Playfair Display"', 'serif'],
        sans: ['"Playfair Display"', 'serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(45, 217, 199, 0.15)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.6)', opacity: '0.8' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
