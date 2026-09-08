/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2024,
    sourceType: 'module',
  },
  ignorePatterns: ['node_modules/', 'coverage/', 'test-results/', 'playwright-report/', 'blob-report/'],
  rules: {
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
  overrides: [
    {
      files: ['public/**/*.js'],
      env: {
        browser: true,
        node: true,
      },
    },
    {
      files: ['tests/**/*.js', '**/*.test.js'],
      env: {
        jest: true,
      },
    },
    {
      files: ['tests/e2e/**/*.js', 'playwright.config.js'],
      env: {
        browser: true,
      },
    },
  ],
};
