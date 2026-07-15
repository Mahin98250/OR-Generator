import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      boxShadow: {
        glass: '0 24px 80px rgba(0, 0, 0, 0.28)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#dae6ff',
          200: '#b9ccff',
          300: '#8dacff',
          400: '#6d7cff',
          500: '#5160ff',
          600: '#3f49ef',
          700: '#3539cb',
          800: '#3032a0',
          900: '#2d307d',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;