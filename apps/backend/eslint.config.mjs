import tseslint from 'typescript-eslint';
import baseConfig from '@fishmarket/eslint-config';

export default tseslint.config(
  ...baseConfig,
  {
    ignores: [
      'scratch/**',
      'server_lint*.json',
      'final_server_error.txt',
      'migrate_*.ts',
      'vitest.config.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
