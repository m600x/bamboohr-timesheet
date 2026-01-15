module.exports = {
    env: {
        node: true,
        es2020: true
    },
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'script'
    },
    rules: {
        indent: ['error', 4, { SwitchCase: 1 }],
        semi: ['error', 'always'],
        'no-console': 'off',
        'no-unused-vars': 'warn'
    }
};