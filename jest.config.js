module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/unit/**/*.test.js'],
    testSequencer: '<rootDir>/tests/testSequencer.js',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    collectCoverageFrom: [
        '*.js',
        '!jest.config.js',
        '!eslint.config.js'
    ],
    coverageDirectory: 'coverage',
    verbose: true
};
