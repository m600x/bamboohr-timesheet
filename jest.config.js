module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/unit/**/*.test.js'],
    testSequencer: '<rootDir>/tests/testSequencer.js',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    collectCoverageFrom: [
        'src/**/*.js'
    ],
    coverageDirectory: 'coverage',
    verbose: true
};
