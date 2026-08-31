module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  globals: {
    // vitest globals (tests run with `globals: true` in vitest.config.ts).
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    vi: 'readonly',
    suite: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
  },
  ignorePatterns: ['node_modules', 'dist', 'drizzle', 'data', '*.config.ts', '*.cjs'],
  rules: {
    // Underscore-prefixed names are conventionally "intentionally unused"
    // (e.g. `errorResponseBuilder: (_req, _context) => …`).
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      // Tests keep unused fixture rows/columns on purpose and are excluded
      // from the tsc `noUnusedLocals` check — downgrade to a warning there.
      files: ['tests/**/*.ts'],
      rules: { '@typescript-eslint/no-unused-vars': 'warn' },
    },
  ],
}