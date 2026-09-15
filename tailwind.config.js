/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './types.ts',
    './types/**/*.ts',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
        sans: ['"Share Tech Mono"', 'monospace'],
      },
      colors: {
        tech: {
          bg: '#020402',
          panel: '#0a0f0a',
          primary: '#00ff41', // Matrix Green
          secondary: '#0ea5e9', // Cyber Cyan
          accent: '#ffb000', // Amber
          dim: '#1a2e1a',
          border: '#2d4a2d',
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(to right, #112211 1px, transparent 1px), linear-gradient(to bottom, #112211 1px, transparent 1px)',
        'striped-pattern': 'repeating-linear-gradient(45deg, #0a0f0a, #0a0f0a 10px, #0f1a0f 10px, #0f1a0f 20px)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        flicker: 'flicker 0.15s infinite',
        scanline: 'scanline 8s linear infinite',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        glitch: 'glitch 1s linear infinite',
        'border-pulse': 'borderPulse 2s infinite',
        shimmer: 'shimmer 2.5s infinite linear',
        'broken-shake': 'brokenShake 0.2s cubic-bezier(.36,.07,.19,.97) infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.9' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        borderPulse: {
          '0%, 100%': { borderColor: '#2d4a2d' },
          '50%': { borderColor: '#00ff41' },
        },
        glitch: {
          '2%, 64%': { transform: 'translate(2px,0) skew(0deg)' },
          '4%, 60%': { transform: 'translate(-2px,0) skew(0deg)' },
          '62%': { transform: 'translate(0,0) skew(5deg)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        brokenShake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0) rotate(1deg)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-2px, 0, 0) rotate(-1deg)' },
          '40%, 60%': { transform: 'translate3d(2px, 0, 0)' },
        },
      },
    },
  },
  plugins: [],
};
