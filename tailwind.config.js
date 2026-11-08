/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{vue,ts,js}'],
  theme: {
    extend: {
      // —— 统一断点（语义命名，全项目共用同一组数值）——
      // 之前各文件写过 860 / 900 / 1100 三个不同的阈值，导致
      // 860~900px 区间里侧边栏已折叠、但设置页保存栏还偏移 300px。
      screens: {
        // 手机：单列、加大点按区域
        compact: { max: '599px' },
        // 侧边栏折叠成顶部导航（含大屏手机横屏、竖屏平板）
        stacked: { max: '899px' },
        // 平板及以上
        tablet: { min: '600px', max: '899px' },
        // 详情面板内联显示在右侧（低于此宽度改为底部抽屉）
        inline: { min: '1200px' },
      },

      // —— Cloudreve / Material Design 配色 ——
      // 颜色名沿用原来的语义名（视图里已经在用），只把值换成 CSS 变量，
      // 这样所有 class 名继续有效，同时获得浅色 / 深色两套外观。
      // 变量定义在 web/src/style.css 的 :root 与深色块里；默认主色是
      // Cloudreve 的 #3498db（见该文件的注释）。
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--c-tint) / <alpha-value>)', // Cloudreve 默认主色
          dark: 'rgb(var(--c-tint-dark) / <alpha-value>)',
          light: 'rgb(var(--c-tint-light) / <alpha-value>)',
          // 淡色填充（主色 12% 底），用于 chip / 提示条
          soft: 'rgb(var(--c-tint) / 0.12)',
          container: 'rgb(var(--c-tint) / 0.12)',
        },
        'on-primary': '#FFFFFF',
        'on-primary-container': 'rgb(var(--c-label) / 1)',

        secondary: 'rgb(var(--c-label-2) / 0.6)', // text.secondary
        'secondary-container': 'rgb(var(--c-fill) / 0.08)', // hover / 填充层
        'on-secondary-container': 'rgb(var(--c-label) / 1)',

        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-container-lowest': 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-container-low': 'rgb(var(--c-surface-2) / <alpha-value>)',
        // 注意别用 <alpha-value>：默认 alpha=1 会让保存栏变成一整块纯灰
        'surface-container': 'rgb(var(--c-fill) / 0.08)',
        'surface-container-high': 'rgb(var(--c-fill) / 0.16)',
        'surface-container-highest': 'rgb(var(--c-fill) / 0.24)',
        'surface-variant': 'rgb(var(--c-fill) / <alpha-value>)',
        'on-surface': 'rgb(var(--c-label) / 1)',
        'on-surface-variant': 'rgb(var(--c-label-2) / 0.6)',

        // Material divider：1px，12% 透明度
        outline: 'rgb(var(--c-separator) / 0.26)',
        'outline-variant': 'rgb(var(--c-separator) / 0.12)',

        error: 'rgb(var(--c-red) / <alpha-value>)', // MUI error
        'error-container': 'rgb(var(--c-red) / 0.12)',
        'on-error-container': 'rgb(var(--c-red) / 1)',

        // 语义别名：视图里沿用这些名字
        canvas: 'rgb(var(--c-bg) / <alpha-value>)', // MUI background.default
        ink: 'rgb(var(--c-label) / 0.87)', // text.primary
        muted: 'rgb(var(--c-label-2) / 0.6)', // text.secondary
        faint: 'rgb(var(--c-label-3) / 0.38)', // text.disabled
        rule: 'rgb(var(--c-separator) / 0.12)', // divider
        soft: 'rgb(var(--c-fill) / 0.12)', // hover / 填充层
        danger: 'rgb(var(--c-red) / 1)',
        dangerSoft: 'rgb(var(--c-red) / 0.12)',
        success: 'rgb(var(--c-green) / 1)', // MUI success
        warn: 'rgb(var(--c-orange) / 1)', // MUI warning

        // 兼容别名
        accent: 'rgb(var(--c-tint) / <alpha-value>)',
      },

      // MUI 圆角：统一 8px，弹窗 12px，抽屉 16px
      borderRadius: {
        none: '0',
        xs: '4px', // 小控件
        sm: '8px', // chip、小按钮
        DEFAULT: '8px', // Paper / 卡片 / 输入框
        md: '8px',
        lg: '12px', // 弹窗
        xl: '16px', // 底部抽屉
        full: '9999px', // 圆形图标按钮、chip、switch 轨道
      },

      // MUI elevation：Paper 靠阴影分层，不是靠背景色差
      boxShadow: {
        e0: 'none',
        e1: '0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06)',
        e2: '0 3px 6px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.08)',
        e3: '0 8px 24px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.10)',
        // 兼容旧名
        card: '0 1px 2px rgba(0,0,0,.04), 0 1px 8px rgba(0,0,0,.06)',
        raised: '0 2px 8px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.08)',
        dialog: '0 8px 30px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.08)',
      },

      fontFamily: {
        // Cloudreve 官方前端用 Material-UI，默认 Roboto。
        // 中文回落到各平台系统字体。
        sans: [
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'PingFang SC',
          'Noto Sans SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
