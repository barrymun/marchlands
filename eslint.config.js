// Lint rules (code quality only: Prettier owns formatting, see .prettierrc.json).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import i18next from 'eslint-plugin-i18next';
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
    // Text a player reads comes from the locale files (AGENTS.md, Translations): no words written in JSX, in the
    // attributes a player reads, or in toast and useCommand messages. Strings with no letters (— · ×3), single
    // letters (x, y) and the game's name are fine.
    files: ['client/web/src/**/*.{ts,tsx}'],
    ignores: ['client/web/src/components/ui/**', 'client/web/src/**/*.test.ts'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': { include: ['title', 'placeholder', 'alt', 'aria-label', 'aria-description', 'aria-valuetext', 'label', 'description'] },
          words: { exclude: [/^[^\p{L}]*$/u, /^\p{L}$/u, '[0-9!-/:-@[-`{-~]+', '[A-Z_-]+', 'Marchlands'] },
        },
      ],
      'no-restricted-syntax': [
        'error',
        ...[
          "CallExpression[callee.name='toast'] > Literal[value=/\\p{L}/u]",
          "CallExpression[callee.object.name='toast'] > Literal[value=/\\p{L}/u]",
          "CallExpression[callee.name='toast'] > TemplateLiteral:has(TemplateElement[value.raw=/\\p{L}/u])",
          "CallExpression[callee.object.name='toast'] > TemplateLiteral:has(TemplateElement[value.raw=/\\p{L}/u])",
          "CallExpression[callee.name=/^toast$|^useCommand$/] Property[key.name='description'] > Literal[value=/\\p{L}/u]",
          "CallExpression[callee.name='useCommand'] > Literal[value=/\\p{L}/u]",
          "CallExpression[callee.name='useCommand'] > TemplateLiteral:has(TemplateElement[value.raw=/\\p{L}/u])",
        ].map((selector) => ({ selector, message: 'Player-facing text goes in the locale files: use t() (see AGENTS.md, Translations).' })),
      ],
    },
  },
  {
    // shadcn/ui components export their variants next to the component
    files: ['client/web/src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  prettier,
);
