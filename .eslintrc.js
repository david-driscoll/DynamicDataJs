module.exports = {
    env: {
        browser: true,
        es6: true,
        node: true,
    },
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/eslint-recommended', 'plugin:promise/recommended', 'plugin:unicorn/recommended', 'plugin:prettier/recommended'],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    rules: {
        quotes: ['error', 'single'],
        semi: ['error', 'always'],
        'no-undef': 'off',
        'no-unused-vars': 'off',
        'unicorn/filename-case': 'off',
        'no-nested-ternary': 'off',
        'unicorn/no-null': 'off',
        'unicorn/no-nested-ternary': 'off',
    },
};
