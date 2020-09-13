module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    collectCoverage: true,
    globals: {
        'ts-jest': {
            compiler: 'typescript',
            tsConfig: {
                importHelpers: true,
                target: 'ES6',
                module: 'commonjs',
            },
        },
    },
};
