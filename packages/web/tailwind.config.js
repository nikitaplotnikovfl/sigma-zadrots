/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#070310',
        'bg-soft': '#0d0718',
        'bg-elev': '#140b22',
        neon: {
          magenta: '#ff2bd6',
          purple: '#b026ff',
          cyan: '#2de2ff',
        },
        text: {
          DEFAULT: '#f4ecff',
          dim: '#b9a9d6',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        sans: ['"Exo 2"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-magenta':
          '0 0 4px #ff2bd6, 0 0 12px rgba(255,43,214,.7), 0 0 28px rgba(255,43,214,.45)',
        'neon-purple':
          '0 0 4px #b026ff, 0 0 12px rgba(176,38,255,.7), 0 0 28px rgba(176,38,255,.45)',
        'neon-cyan':
          '0 0 4px #2de2ff, 0 0 12px rgba(45,226,255,.7), 0 0 28px rgba(45,226,255,.4)',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '45%': { opacity: '1' },
          '50%': { opacity: '.78' },
          '55%': { opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(1.25)' },
        },
      },
      animation: {
        flicker: 'flicker 4.5s infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
