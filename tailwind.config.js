/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enables manual class-based dark mode
  theme: {
    extend: {
      colors: {
        tokyo: {
          bg: '#0b0f19',       // Deep midnight canvas
          lightBg: '#f5f7fa',  // Sleek minimalist light canvas
          card: 'rgba(17, 24, 39, 0.7)', // Dark glass container
          lightCard: 'rgba(255, 255, 255, 0.75)', // Light glass container
          torii: '#ff4a5a',    // Neon Torii gate red
          sakura: '#f687b3',   // Cherry blossom pink
          pond: '#00f2fe',     // Glowing Zen pond cyan
          bamboo: '#00e676',   // Radiant bamboo green
          fuji: '#8a2be2',     // Mt Fuji deep violet
          gold: '#ffd700',     // Golden temple amber
          darkText: '#f3f4f6', // Premium light grey for text in dark mode
          lightText: '#1f2937',// Charcoal grey for text in light mode
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        kanji: ['Yu Mincho', 'MS Mincho', 'Hiragino Mincho ProN', 'serif', 'sans-serif'] // Elegant brushstroke rendering
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
        glassLight: '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
        torii: '0 0 15px 0px rgba(255, 74, 90, 0.4)',
        sakura: '0 0 15px 0px rgba(246, 135, 179, 0.4)',
        pond: '0 0 15px 0px rgba(0, 242, 254, 0.4)',
        bamboo: '0 0 15px 0px rgba(0, 230, 118, 0.4)',
      }
    },
  },
  plugins: [],
}
