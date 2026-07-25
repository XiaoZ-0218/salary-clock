/* ESLint 配置（Legacy .eslintrc，需 ESLint 8.x）
 * 纯 TypeScript 项目（无 React/Vue），仅启用 TS 基础推荐规则。
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // 保守配置：与本项目风格冲突的规则降级为 warn / off，避免 lint 噪声
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-inferrable-types': 'off',
    'no-constant-condition': ['error', { checkLoops: false }],
  },
  ignorePatterns: ['out/**', 'node_modules/**', '*.js', '*.cjs', 'web/**'],
};
