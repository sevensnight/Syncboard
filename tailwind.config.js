module.exports = {
  darkMode: 'class',
  content: [
    './public/**/*.{html,js}',
    './src/client/**/*.{js,html}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d9d9de',
          300: '#b8b8c1',
          400: '#8e8e9a',
          500: '#6b6b78',
          600: '#555561',
          700: '#45454f',
          800: '#3b3b43',
          900: '#121217',
          950: '#0a0a0d',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
      },
      fontFamily: {
        sans: [
          '"Inter"',
          '"Noto Sans SC"',
          '"Noto Sans TC"',
          '"Noto Sans JP"',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        DEFAULT: '0.625rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 15, 20, 0.04), 0 4px 16px rgba(15, 15, 20, 0.04)',
        lift: '0 8px 28px rgba(15, 15, 20, 0.08)',
        pop: '0 16px 48px rgba(15, 15, 20, 0.14)',
      },
    },
  },
  plugins: [],
};
