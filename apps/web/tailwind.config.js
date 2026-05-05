const { join } = require('path')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
  ],
  theme: {
    extend: {
      colors: {
        acai: {
          50: '#f5eef2',
          100: '#e8d9e2',
          200: '#d1b8c8',
          300: '#b08fa3',
          400: '#8c6a7e',
          500: '#6f4f63',
          600: '#4a3545',
          700: '#2f222e',
          800: '#1f161f',
          900: '#140e15',
          950: '#0c080d',
        },
      },
    },
  },
  plugins: [],
}
