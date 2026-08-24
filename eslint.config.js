const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      // Deno runtime, not React Native; linted by `deno lint` instead.
      'supabase/functions/**',
      // Vendored Claude Code skill scripts, not project source.
      '.claude/**',
    ],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // CLI scripts report progress on stdout; that is their interface.
    files: ['scripts/**/*.{js,mjs,cjs}'],
    rules: { 'no-console': 'off' },
  },
];
