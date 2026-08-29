import containerQueries from '@tailwindcss/container-queries'
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        'engine-black':  '#0D0D0D',
        'engine-green':  '#00FF41',
        'engine-card':   '#161616',
        'engine-border': 'rgba(0,255,65,0.3)',
        'surface':      '#1A1A1A',
        'surface-2':    '#161616',
        'border-base':  '#222222',
        'border-subtle':'#2A2A2A',
        'text-primary': '#E8E8E8',
        'text-muted':   '#888888',
        'accent':       '#00FF41',
        'warn':         '#FFB800',
        'danger':       '#FF3333',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body:    ['IBM Plex Mono', 'monospace'],
        ui:      ['Rajdhani', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
      boxShadow: {
        'glow':  '0 0 8px rgba(0,255,65,0.6), 0 0 20px rgba(0,255,65,0.2)',
        'card':  '0 0 0 1px rgba(0,255,65,0.15), 0 4px 24px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'razer-pulse': {
          '0%, 100%': { opacity: '1', color: '#00FF41' },
          '50%': { opacity: '0.3', color: '#00FF41' },
        }
      },
      animation: {
        'slide-down': 'slide-down 0.3s ease-out forwards',
        'razer-pulse': 'razer-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [containerQueries],
} satisfies Config
