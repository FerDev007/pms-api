import forms from '@tailwindcss/forms'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f6f4ef',
        surface: '#ffffff',
        line: '#e7e3da',
        ink: '#1c1b18',
        muted: '#87816f',
        brand: { DEFAULT: '#1c1b18', 600: '#1c1b18', 700: '#000000', soft: '#efece4' },
        accent: '#3a3833',
        good: { DEFAULT: '#3f7d5d', soft: '#eef4ee', line: '#cfe0d2' },
        warn: { DEFAULT: '#9c6d1e', soft: '#f9f3e4', line: '#ead9b0' },
        bad: { DEFAULT: '#b5473f', soft: '#f9edea', line: '#e9c9c3' }
      },
      fontFamily: {
        display: ['Bricolage Grotesque', 'sans-serif'],
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,27,24,.04), 0 8px 24px -16px rgba(28,27,24,.14)',
        lift: '0 2px 4px rgba(28,27,24,.05), 0 16px 32px -16px rgba(28,27,24,.18)',
        float: '0 24px 48px -16px rgba(28,27,24,.22)',
        fab: '0 10px 24px -8px rgba(28,27,24,.4)'
      }
    }
  },
  plugins: [forms]
}
