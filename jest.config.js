module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    globals: {
        'ts-jest': {
            'compiler': 'typescript',
            tsConfig: {
                importHelpers: true,
                target: 'ES6',
                module: 'commonjs'
            },
        },
    },
};