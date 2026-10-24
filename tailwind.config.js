/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{vue,ts,js}'],
  theme: {
    extend: {
      // —— Material 3 tonal palette（蓝色 key color 生成的色调色板）——
      // 参考 M3 的颜色角色：primary / surface-container / outline / error …
      colors: {
        primary: {
          DEFAULT: '#00639B', // primary (T40)
          dark: '#004E75',
          light: '#4FA3D1',
          soft: '#C8E7FF', // primary-container (T90)
          container: '#C8E7FF',
        },
        'on-primary': '#FFFFFF',
        'on-primary-container': '#001F2C',

        secondary: '#4F6169',
        'secondary-container': '#D2E4EC',
        'on-secondary-container': '#0C1C22',

        surface: '#FCFCFD',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F7F9FC',
        'surface-container': '#F2F5F8',
        'surface-container-high': '#ECEFF3',
        'surface-container-highest': '#E6EAEE',
        'surface-variant': '#DFE3E8',
        'on-surface': '#1A1C1E',
        'on-surface-variant': '#44484D',

        outline: '#74787D',
        'outline-variant': '#C4C8CC',

        error: '#BA1A1A',
        'error-container': '#FFDAD6',
        'on-error-container': '#410002',

        // 语义别名：视图里沿用这些名字，值指向 M3 对应角色
        canvas: '#F7F9FC', // surface-container-low
        ink: '#1A1C1E', // on-surface
        muted: '#44484D', // on-surface-variant
        faint: '#74787D', // outline
        rule: '#C4C8CC', // outline-variant
        soft: '#F2F5F8', // surface-container
        danger: '#BA1A1A',
        dangerSoft: '#FFDAD6', // error-container
        success: '#146C43',
        warn: '#8A5000',

        // 兼容别名
        accent: '#00639B',
      },

      // M3 shape scale
      borderRadius: {
        none: '0',
        xs: '4px', // extra-small：文本框
        sm: '8px', // small：chip
        DEFAULT: '12px', // medium：卡片
        md: '12px',
        lg: '16px', // large：抽屉、大卡片
        xl: '28px', // extra-large：底部抽屉
        full: '9999px', // full：按钮、导航指示器
      },

      // M3 elevation（tonal elevation 的阴影值）
      boxShadow: {
        e0: 'none',
        e1: '0 1px 2px 0 rgba(0,0,0,.30), 0 1px 3px 1px rgba(0,0,0,.15)',
        e2: '0 1px 2px 0 rgba(0,0,0,.30), 0 2px 6px 2px rgba(0,0,0,.15)',
        e3: '0 1px 3px 0 rgba(0,0,0,.30), 0 4px 8px 3px rgba(0,0,0,.15)',
        // 兼容旧名
        card: '0 1px 2px 0 rgba(0,0,0,.30), 0 1px 3px 1px rgba(0,0,0,.15)',
        raised: '0 1px 2px 0 rgba(0,0,0,.30), 0 2px 6px 2px rgba(0,0,0,.15)',
        dialog: '0 1px 3px 0 rgba(0,0,0,.30), 0 4px 8px 3px rgba(0,0,0,.15)',
      },

      fontFamily: {
        sans: [
          'Roboto',
          'Roboto Flex',
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
    },
  },
  plugins: [],
};
