import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        hand: ['Caveat', 'cursive'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          bg: '#DDE8F4',
          ink: '#0B1C2C',
          accent: '#1A6B9A',
          muted: '#4A6B8A',
          surface: '#C8D9ED',
          border: '#8AAAC8',
          danger: '#C0392B',
          success: '#27AE60',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
