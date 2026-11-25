/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        editorial: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        obsidian: {
          950: '#07090F',
          900: '#0A0D15',
          850: '#0D111A',
          800: '#131926',
          700: '#1B2335',
        },
        alabaster: {
          50: '#FFFFFF',
          100: '#F8F7F4',
          200: '#F1EFEA',
          300: '#E7E4DC',
        },
      },
      boxShadow: {
        prism: '0 0 0 1px rgba(96, 165, 250, 0.25), 0 8px 28px -8px rgba(96, 165, 250, 0.28)',
      },
    },
  },
  plugins: [],
};
