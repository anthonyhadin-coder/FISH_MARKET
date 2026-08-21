import eslintConfig from '@fishmarket/eslint-config';

export default [
  ...eslintConfig,
  {
    ignores: ['dist/**', 'node_modules/**', '.turbo/**']
  }
];
