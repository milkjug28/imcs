/** @type {import('tailwindcss').Config} */
module.exports = {
  important: '[data-savant-radio]',
  content: [
    './src/components/SavantRadioWidget.tsx',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#FFD600',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
}
