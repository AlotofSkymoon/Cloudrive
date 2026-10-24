/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{vue,ts,js}'],
  theme: {
    extend: {
      // Cloudreve 风格：Material Design 蓝白体系
      colors: {
        primary: {
          DEFAULT: '#1976d2',
          dark: '#1565c0',
          light: '#42a5f5',
          soft: '#e3f2fd',
        },
        surface: '#ffffff',
        canvas: '#f5f5f5',
        ink: '#212121',
        muted: '#757575',
        faint: '#9e9e9e',
        rule: '#e0e0e0',
        soft: '#fafafa',
        danger: '#d32f2f',
        dangerSoft: '#ffebee',
        // 兼容别名：旧组件里的内联类仍能用
        accent: '#1976d2',
        paper: '#f5f5f5',
        success: '#2e7d32',
        warn: '#ed6c02',
      },
      fontFamily: {
        sans: [
          'Roboto',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Noto Sans SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SF Mono', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06)',
        raised: '0 2px 4px rgba(0,0,0,.1), 0 4px 12px rgba(0,0,0,.08)',
        dialog: '0 8px 32px rgba(0,0,0,.18)',
      },
    },
  },
  plugins: [],
};
