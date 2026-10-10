// Lint rules (code quality only: Prettier owns formatting, see .prettierrc.json).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules', '**/dist', 'shared/api-client/src/generated', 'backend/packages/db/migrations', 'db'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      // `_name` marks an argument or binding kept on purpose
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['client/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // shadcn/ui components export their variants next to the component
    files: ['client/web/src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  prettier,
);
