module.exports = {
    env: {
        browser: true,
        node: true,
        commonjs: true,
        es2020: true,
        'jest/globals': true,
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 12,
    },
    plugins: ['jest'],
    rules: {},
};
