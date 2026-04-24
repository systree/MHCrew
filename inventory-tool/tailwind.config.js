export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        nunito: ['Nunito', 'sans-serif'],
      },
      colors: {
        // Red primary — matches crew app --color-primary
        brand: {
          50:  '#1f0f14',
          100: '#2d1520',
          200: '#5a2535',
          300: '#c73652',
          400: '#d44060',
          500: '#e94560',
          600: '#e94560',
          700: '#c73652',
          800: '#f0f0f5',
        },
        // Dark navy scale — matches crew app surface/bg/text vars
        warm: {
          50:  '#0f0f1a',
          100: '#1a1a2e',
          200: '#2a2a45',
          300: '#3a3a5c',
          400: '#55556a',
          500: '#8888aa',
          600: '#9999bb',
          700: '#b0b0d0',
          800: '#d0d0e8',
          900: '#f0f0f5',
        },
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)',
        item: '0 0 0 2px rgba(233,69,96,0.25)',
      },
    },
  },
  plugins: [],
}
