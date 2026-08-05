module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: { node: true, jest: true },
  // The frontends carry their own ESLint setups (eslint-config-next); keeping
  // them out of this config's file enumeration prevents ESLint from loading
  // their configs when it walks the tree from the repository root.
  ignorePatterns: ['.eslintrc.js', 'frontend/', 'beleqet-jobs-nextjs/', 'dist/', 'coverage/'],
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules', 'coverage', 'beleqet-jobs-nextjs', 'frontend'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    // Interface-conforming parameters are named even when a given
    // implementation ignores them; `_`-prefixing marks that intent.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
    ],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': 'warn',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-unsafe-function-type': 'off',
  },
};
