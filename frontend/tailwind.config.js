import forms from '@tailwindcss/forms'

// Los colores son variables CSS (canales R G B) para que el tema claro/oscuro se cambie
// con un solo atributo data-theme en <html>. El formato rgb(var(--x) / <alpha-value>)
// conserva los modificadores de opacidad de Tailwind (bg-surface/60, text-brand/40, etc.).
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: withAlpha('--c-canvas'),
        surface: withAlpha('--c-surface'),
        line: withAlpha('--c-line'),
        ink: withAlpha('--c-ink'),
        muted: withAlpha('--c-muted'),
        brand: {
          DEFAULT: withAlpha('--c-brand'),
          600: withAlpha('--c-brand'),
          700: withAlpha('--c-brand-700'),
          soft: withAlpha('--c-brand-soft')
        },
        accent: withAlpha('--c-accent'),
        good: { DEFAULT: withAlpha('--c-good'), soft: withAlpha('--c-good-soft'), line: withAlpha('--c-good-line') },
        warn: { DEFAULT: withAlpha('--c-warn'), soft: withAlpha('--c-warn-soft'), line: withAlpha('--c-warn-line') },
        bad: { DEFAULT: withAlpha('--c-bad'), soft: withAlpha('--c-bad-soft'), line: withAlpha('--c-bad-line') }
      },
      fontFamily: {
        display: ['Bricolage Grotesque', 'sans-serif'],
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.05), 0 8px 24px -16px rgba(0,0,0,.18)',
        lift: '0 2px 4px rgba(0,0,0,.06), 0 16px 32px -16px rgba(0,0,0,.22)',
        float: '0 24px 48px -16px rgba(0,0,0,.28)',
        fab: '0 10px 24px -8px rgba(0,0,0,.45)'
      }
    }
  },
  plugins: [forms]
}
