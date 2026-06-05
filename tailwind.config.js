/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shell:     'var(--shell-1)',
        primary:   'var(--primary)',
        accent:    'var(--accent)',
        'accent-2':'var(--accent-2)',
        gold:      'var(--gold)',
        sand:      'var(--sand)',
        panel:     'var(--panel)',
        card:      'var(--card)',
        'card-2':  'var(--card-2)',
        ink:       'var(--ink)',
        muted:     'var(--muted)',
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", 'serif'],
        sans:    ["'Noto Sans Thai'", "'Manrope'", 'system-ui', 'sans-serif'],
        num:     ["'Manrope'", 'sans-serif'],
      },
    },
  },
  plugins: [],
};
