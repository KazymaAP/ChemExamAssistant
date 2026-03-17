export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        Notification: 'readonly',
        Telegram: 'readonly',
        AudioContext: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      complexity: ['warn', 20],
      'max-lines': ['warn', { max: 1200, skipBlankLines: true, skipComments: true }]
    }
  }
];
