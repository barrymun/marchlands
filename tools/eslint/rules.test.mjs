// The repo's own lint rules: what each refuses and what it leaves alone.

import path from 'node:path';

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, it } from 'vitest';

import importSpacing from './import-spacing.mjs';
import noStringCompare from './no-string-compare.mjs';
import noStringValue from './no-string-value.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const typed = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: FIXTURES } },
});
const plain = new RuleTester({ languageOptions: { parser: tseslint.parser } });
const FILE = path.join(FIXTURES, 'file.ts');
const inFile = (code) => ({ code, filename: FILE });

const PAN = `const Pan = { UP: 'up', DOWN: 'down' } as const;
type Pan = (typeof Pan)[keyof typeof Pan];
declare function pan(to: Pan): void;
`;
const named = (code) => ({ ...inFile(PAN + code), errors: [{ messageId: 'named' }] });

typed.run('no-string-value', noStringValue, {
  valid: [
    // by name
    inFile(`${PAN}pan(Pan.UP);`),
    // the same word where the code doesn't ask for the set
    inFile(`${PAN}const word: string = 'up'; declare function say(s: string): void; say('up');`),
    // a set no const object names: a message code, a translation key
    inFile(`${PAN}declare function msg(code: 'hero.locked' | 'hero.busy'): void; msg('hero.locked');`),
    // a set of which a const object names only some values
    inFile(`${PAN}declare function side(to: 'up' | 'down' | 'left'): void; side('up');`),
    // a generic taking the string it's given, as t() does, even a word a set names
    inFile(`${PAN}declare function t<K extends string>(key: K): void; t('up');`),
    // an object's key, and a comparison (no-string-compare's)
    inFile(`${PAN}const rates: Record<Pan, number> = { up: 1, down: 2 }; declare const to: Pan; export const up = to === 'up';`),
    // a const object with no type beside it isn't a named set
    inFile(`const Word = { UP: 'up' } as const; declare function say(s: 'up' | 'down'): void; say('up'); export { Word };`),
    // the declaration itself
    inFile(PAN),
  ],
  invalid: [
    { ...named(`pan('up');`), errors: [{ messageId: 'named', data: { value: 'up', names: 'Pan.UP' } }] },
    named('pan(`down`);'),
    named(`const to: Pan = 'up';`),
    named(`const moves: Pan[] = ['up'];`),
    named(`const move: { to: Pan } = { to: 'down' };`),
    named(`function go(to: Pan = 'down') { return to; }`),
    named(`declare const near: boolean; pan(near ? Pan.UP : 'down');`),
    // part of a set, and a set beside null
    named(`const up: typeof Pan.UP | typeof Pan.DOWN | null = 'up';`),
    // a discriminant
    named(`const move: { kind: typeof Pan.UP } = { kind: 'up' };`),
    // two sets together
    {
      ...inFile(`${PAN}const Fort = { TRAP: 'trap' } as const; type Fort = (typeof Fort)[keyof typeof Fort]; const key: Pan | Fort = 'trap';`),
      errors: [{ messageId: 'named', data: { value: 'trap', names: 'Fort.TRAP' } }],
    },
  ],
});

plain.run('no-string-compare', noStringCompare, {
  valid: [
    `x === Named.VALUE;`,
    `x === '';`,
    `typeof x === 'string';`,
    `e.key === 'Enter';`,
    `event.type === 'keydown';`,
    `process.env.NODE_ENV === 'production';`,
    `x == 'y';`,
    `switch (e.key) { case 'Enter': break; }`,
  ],
  invalid: [
    { code: `x === 'y';`, errors: [{ messageId: 'named', data: { value: 'y' } }] },
    { code: `'y' !== x;`, errors: [{ messageId: 'named' }] },
    { code: `switch (x) { case 'y': break; }`, errors: [{ messageId: 'named' }] },
  ],
});

/** Import statements from these modules, one a line; '' leaves a blank line. */
const imports = (...sources) => sources.map((s) => (s ? `import '${s}';` : '')).join('\n');

plain.run('import-spacing', importSpacing, {
  valid: [
    // more than 3 imports: one blank line between every kind of group, in the order the groups go
    imports('./a.css', '', 'node:fs', '', 'react', '', '@marchlands/core', '', '@/lib/a', '', './b'),
    // none inside a group
    imports('a', 'b', 'c', 'd'),
    // what counts as one group
    imports('./a.css', './b.scss', './c.sass', '', 'd'),
    imports('#/a.ts', '#test/b.ts', '@/c', '@/d'),
    imports('./a', '../b', '../../c', './d'),
    imports('react', '@tanstack/react-query', 'zod', 'vitest'),
    imports('@marchlands/core', '@marchlands/db', '@marchlands/game', '', './z'),
    // 3 imports or fewer stay together, whatever their groups, and only imports count towards that
    imports('react', '@marchlands/core', './a'),
    imports('react', './a'),
    imports('react'),
    `${imports('react', '@marchlands/core', './a')}\n\nconst x = 1;\nconst y = 2;\nexport { x, y };`,
    // the threshold's other side: the fourth import makes the gaps wanted
    imports('react', '', '@marchlands/core', '@marchlands/db', '@marchlands/game'),
    // named, default and type imports are imports like the side-effect ones
    `import a from 'a';\n\nimport { b } from '@marchlands/b';\nimport type { C } from '@marchlands/c';\nimport * as d from '@marchlands/d';`,
    // a comment or a statement between two imports is left alone, with or without a blank line
    `import 'a';\n\n// why\n\nimport 'b';\nimport 'c';\nimport 'd';`,
    `import 'a';\n// why\nimport '@marchlands/b';\nimport '@marchlands/c';\nimport '@marchlands/d';`,
    `import 'a';\n/* why */ import './b';\nimport './c';\nimport './d';`,
    `import 'a';\nconst x = 1;\nimport './b';\n\n\nconst y = x;\nimport './c';\nimport './d';\nexport { y };`,
    // Windows line endings count the same
    `import 'a';\r\n\r\nimport './b';\r\nimport './c';\r\nimport './d';`,
    `import 'a';\r\nimport './b';`,
    // nothing to check
    `const x = 1;\nexport { x };`,
    '',
  ],
  invalid: [
    // more than 3 imports: a missing gap, for each pair of groups next to each other
    ...[
      ['./a.css', 'stylesheet', 'node:fs', 'builtin'],
      ['node:fs', 'builtin', 'react', 'package'],
      ['react', 'package', '@marchlands/core', 'workspace'],
      ['@marchlands/core', 'workspace', '#/a.ts', 'local'],
      ['@/a', 'local', './b', 'relative'],
    ].map(([from, prev, to, next]) => ({
      // two more of the second group, for more than 3 imports
      code: imports(from, to, `${to}/x`, `${to}/y`),
      output: imports(from, '', to, `${to}/x`, `${to}/y`),
      errors: [{ messageId: 'expectedBlank', data: { prev, next } }],
    })),
    // too many blank lines between groups come down to one
    {
      code: imports('a', '', '', '', './b', './c', './d'),
      output: imports('a', '', './b', './c', './d'),
      errors: [{ messageId: 'expectedBlank', data: { prev: 'package', next: 'relative' } }],
    },
    // a blank line inside a group goes
    {
      code: imports('a', '', 'b', 'c', 'd'),
      output: imports('a', 'b', 'c', 'd'),
      errors: [{ messageId: 'unexpectedBlank' }],
    },
    {
      code: imports('#/a.ts', '', '@/b', '#test/c.ts', '@/d'),
      output: imports('#/a.ts', '@/b', '#test/c.ts', '@/d'),
      errors: [{ messageId: 'unexpectedBlank' }],
    },
    // 3 imports or fewer: a blank line goes even between groups
    {
      code: imports('react', '', '@marchlands/core', '', './a'),
      output: imports('react', '@marchlands/core', './a'),
      errors: [{ messageId: 'unexpectedBlank' }, { messageId: 'unexpectedBlank' }],
    },
    {
      code: imports('react', '', './a'),
      output: imports('react', './a'),
      errors: [{ messageId: 'unexpectedBlank' }],
    },
    // other code doesn't count towards the 3
    {
      code: `${imports('react', '', './a')}\n\nconst x = 1;\nexport { x };`,
      output: `${imports('react', './a')}\n\nconst x = 1;\nexport { x };`,
      errors: [{ messageId: 'unexpectedBlank' }],
    },
    // two imports on a line are split, and given their gap if they want one
    {
      code: `import 'a'; import 'b';`,
      output: `import 'a';\nimport 'b';`,
      errors: [{ messageId: 'unexpectedBlank' }],
    },
    {
      code: `import 'a'; import './b';\nimport './c';\nimport './d';`,
      output: imports('a', '', './b', './c', './d'),
      errors: [{ messageId: 'expectedBlank' }],
    },
    // Windows line endings: a missing gap is still missing, and the fix writes the file's new line as \n
    {
      code: `import 'a';\r\nimport './b';\r\nimport './c';\r\nimport './d';`,
      output: `import 'a';\n\nimport './b';\r\nimport './c';\r\nimport './d';`,
      errors: [{ messageId: 'expectedBlank' }],
    },
    // every problem in a file is reported and fixed at once
    {
      code: imports('a', './b', '', './c', '@marchlands/d'),
      output: imports('a', '', './b', './c', '', '@marchlands/d'),
      errors: [{ messageId: 'expectedBlank' }, { messageId: 'unexpectedBlank' }, { messageId: 'expectedBlank' }],
    },
  ],
});
