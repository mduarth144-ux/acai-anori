const js = require('@eslint/js')

module.exports = [
  js.configs.recommended,
  {
    ignores: ['**/dist', '**/.next/**', '**/node_modules/**'],
  },
]
