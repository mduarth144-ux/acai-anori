const { FlatCompat } = require('@eslint/eslintrc')
const js = require('@eslint/js')
const { fixupConfigRules } = require('@eslint/compat')
const baseConfig = require('../../eslint.config.cjs')

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
})

module.exports = [
  ...fixupConfigRules(compat.extends('next')),

  ...fixupConfigRules(compat.extends('next/core-web-vitals')),

  ...baseConfig,
  {
    ignores: ['.next/**/*', '**/*.d.ts'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
]
