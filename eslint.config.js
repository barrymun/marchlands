// Lint rules (code quality only: Prettier owns formatting, see .prettierrc.json).
import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';
import drizzle from 'eslint-plugin-drizzle';
import i18next from 'eslint-plugin-i18next';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import regexp from 'eslint-plugin-regexp';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import importSpacing from './tools/eslint/import-spacing.mjs';

const RELATIVE_IMPORT = { group: ['./*', '../*'], message: 'Use #/… or #test/… instead of a relative path.' };
const TESTING_IMPORT = { name: '@marchlands/game/testing', message: 'Test hooks only: use @marchlands/game.' };

// The files a tsconfig covers (tsconfig.json, client/web/tsconfig.json), which get the type-aware rules. The rest
// (tools/art, tools/build, the api-client's hand-written files …) are linted without types.
const TYPED = [
  'shared/*/src/**/*.ts',
  'shared/*/test/**/*.ts',
  'backend/packages/*/src/**/*.ts',
  'backend/packages/*/test/**/*.ts',
  'backend/services/*/src/**/*.ts',
  'backend/services/*/test/**/*.ts',
  'backend/packages/db/drizzle.config.ts',
  'tools/battle-sim/**/*.ts',
  'tools/dev/**/*.ts',
  'client/web/src/**/*.{ts,tsx}',
  'client/web/vite.config.ts',
];
// test files, and the fixtures and support code beside them
const TESTS = ['**/*.test.ts', '**/test/**/*.ts'];

export default tseslint.config(
  {
    ignores: ['**/node_modules', '**/dist', 'shared/api-client/src/generated', 'backend/packages/db/migrations', 'db'],
  },
  // an eslint-disable comment that no longer disables anything fails the lint
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  js.configs.recommended,
  tseslint.configs.recommended,
  regexp.configs['flat/recommended'],
  {
    languageOptions: { globals: globals.node },
    rules: {
      // `_name` marks an argument or binding kept on purpose
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'array-callback-return': 'error',
      // == null (null or undefined) is allowed, every other comparison is ===
      eqeqeq: ['error', 'smart'],
      'no-constructor-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'object-shorthand': 'error',
    },
  },
  {
    // Type-aware rules: promises that are never awaited or handled, exhaustive switches, deprecated APIs …
    files: TYPED,
    ignores: ['shared/api-client/**'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
      // an async function without await is how Fastify plugins are written, and how a function meets a type that returns a promise
      '@typescript-eslint/require-await': 'off',
      // a switch over a union covers every member, or has a default
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
    },
  },
  {
    // shadcn/ui is left as shipped (AGENTS.md, Client structure)
    files: ['client/web/src/components/ui/**'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: TESTS,
    plugins: { vitest },
    rules: {
      // tests read API responses and fixtures as untyped JSON, and check methods were called (expect(timer.unref))
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // no it.skip or it.only left behind
      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/no-identical-title': 'error',
    },
  },
  {
    // update(…) and delete(…) on a game transaction or a database always have a where(…)
    files: ['backend/**/*.ts', 'tools/**/*.{ts,mjs}'],
    plugins: { drizzle },
    rules: {
      'drizzle/enforce-delete-with-where': ['error', { drizzleObjectName: ['tx', 'db'] }],
      'drizzle/enforce-update-with-where': ['error', { drizzleObjectName: ['tx', 'db'] }],
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
    files: ['client/web/src/**/*.{ts,tsx}'],
    extends: [pluginQuery.configs['flat/recommended']],
    rules: { '@tanstack/query/no-rest-destructuring': 'error' },
  },
  {
    files: ['client/web/src/**/*.tsx'],
    ignores: ['client/web/src/components/ui/**'],
    extends: [jsxA11y.configs.recommended],
    // the shadcn/ui controls a <label> can wrap
    rules: { 'jsx-a11y-x/label-has-associated-control': ['error', { controlComponents: ['Checkbox', 'Input', 'Switch', 'Textarea'], depth: 3 }] },
  },
  {
    // The client's conventions (AGENTS.md, Client): numbers and dates are formatted for the locale by lib/format.ts,
    // confirmations use ConfirmDialog, and the API is reached through the generated client.
    files: ['client/web/src/**/*.{ts,tsx}'],
    ignores: ['client/web/src/components/ui/**', 'client/web/src/lib/format.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['alert', 'confirm', 'prompt'].map((name) => ({ name, message: 'Ask with ConfirmDialog or ConfirmButton (AGENTS.md, UI conventions).' })),
        { name: 'fetch', message: 'Call the API through the generated client (@marchlands/api-client).' },
      ],
      'no-restricted-properties': [
        'error',
        ...['alert', 'confirm', 'prompt'].map((property) => ({ object: 'window', property, message: 'Ask with ConfirmDialog or ConfirmButton.' })),
        { object: 'window', property: 'fetch', message: 'Call the API through the generated client (@marchlands/api-client).' },
        ...['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].map((property) => ({
          property,
          message: 'Format numbers, dates and times with lib/format.ts (fmt, dateTime, clockTime …), which follows the locale.',
        })),
      ],
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
          words: { exclude: [/^\P{L}*$/u, /^\p{L}$/u, '[0-9!-/:-@[-`{-~]+', '[A-Z_-]+', 'Marchlands'] },
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
