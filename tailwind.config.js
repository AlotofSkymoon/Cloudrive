/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{vue,ts,js}'],
  theme: {
    extend: {
      colors: {
        paper: '#f4f2ec',
        surface: '#fbfaf7',
        ink: '#1c1b18',
        muted: '#6f6a60',
        faint: '#9b958a',
        rule: '#ddd8cd',
        accent: '#1f4d3f',
        danger: '#a3341f',
      },
      fontFamily: {
        serif: ['Georgia', 'Songti SC', 'Noto Serif SC', 'serif'],
        mono: ['ui-monospace', 'SF Mono', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
