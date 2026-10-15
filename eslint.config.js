// Lint rules (code quality only: Prettier owns formatting, see .prettierrc.json).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import importSpacing from './tools/eslint/import-spacing.mjs';

const RELATIVE_IMPORT = { group: ['./*', '../*'], message: 'Use #/… or #test/… instead of a relative path.' };
const TESTING_IMPORT = { name: '@marchlands/game/testing', message: 'Test hooks only: use @marchlands/game.' };

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
    // Imports in groups, each alphabetised: stylesheets, node: builtins, packages, workspace packages (@marchlands/…),
    // local (#/…, #test/…, @/…), relative. Side-effect imports (import '@/index.css') stay where they are, since their
    // order can matter. The blank lines between groups are the marchlands/import-spacing rule's (tools/eslint).
    plugins: { 'import-x': importX, marchlands: { rules: { 'import-spacing': importSpacing } } },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'unknown'],
          pathGroups: [
            { pattern: '**/*.{css,scss,sass}', group: 'builtin', position: 'before' },
            { pattern: '@marchlands/**', group: 'external', position: 'after' },
            { pattern: '{#,#test,@}/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'ignore',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // exactly one blank line after the last import (a comment right after them counts as code)
      'import-x/newline-after-import': ['error', { count: 1, exactCount: true, considerComments: true }],
      'marchlands/import-spacing': 'error',
      // the names inside an import's braces, alphabetised (the import lines themselves are import-x/order's)
      'sort-imports': ['error', { ignoreCase: true, ignoreDeclarationSort: true }],
    },
  },
  {
    // backend and shared imports are absolute: #/… (the package's src) and #test/…, from package.json "imports" (AGENTS.md)
    files: ['backend/**/*.ts', 'shared/core/**/*.ts', 'shared/contracts/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [RELATIVE_IMPORT] }],
    },
  },
  {
    // the game package's test hooks are for tests only: app code uses its index (AGENTS.md, Backend tests)
    files: ['backend/services/*/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [TESTING_IMPORT], patterns: [RELATIVE_IMPORT] }],
    },
  },
  {
    files: ['tools/**/*.{ts,mjs}'],
    rules: { 'no-restricted-imports': ['error', { paths: [TESTING_IMPORT] }] },
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
    // client imports use the full path from src: @/… (AGENTS.md, Client structure)
    files: ['client/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['./*', '../*'], message: 'Use @/… instead of a relative path.' }] }],
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
