import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/build/',
    '**/coverage/',
    '**/.next/',
    '**/.expo/',
    '**/next-env.d.ts',
    'apps/mobile/android/',
    'apps/mobile/ios/',
  ]),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Plain JS config files aren't part of any tsconfig, so type-aware rules can't run on them.
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-properties': [
        'error',
        {
          property: '$queryRawUnsafe',
          message: 'Banned: use the tagged-template $queryRaw so values are parameterized.',
        },
        {
          property: '$executeRawUnsafe',
          message: 'Banned: use the tagged-template $executeRaw so values are parameterized.',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
);
