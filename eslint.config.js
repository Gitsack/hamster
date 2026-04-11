import { configApp } from '@adonisjs/eslint-config'
export default [
  {
    ignores: ['.claude/**', 'build/**', 'tmp/**', '.adonisjs/**', 'storybook-static/**'],
  },
  ...configApp(),
]
