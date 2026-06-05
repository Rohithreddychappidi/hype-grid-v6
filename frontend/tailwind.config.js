/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        '#080a0e',
        surface:   '#0d1117',
        border:    '#1c2230',
        accent:    '#00d4aa',
        danger:    '#ff4757',
        warning:   '#ffa502',
        info:      '#3b82f6',
        muted:     '#3d4a5c',
        text:      '#e2e8f0',
        dim:       '#64748b',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
