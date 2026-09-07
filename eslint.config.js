// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', '.expo/**', '.local-tools/**', 'scripts/private-*.cjs'],
  },
  {
    // Auth and Firestore effects explicitly reset loading/error state before
    // subscribing; this project keeps that established lifecycle pattern.
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
  { files: ['test/**/*.js', 'test/**/*.cjs'], languageOptions: { globals: { __dirname: 'readonly' } } },
]);
