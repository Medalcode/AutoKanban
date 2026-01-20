module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  roots: ['<rootDir>/src'],
  transformIgnorePatterns: [
    "node_modules/(?!(uuid)/)"
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': ['ts-jest', {
      isolateModules: true,
      tsconfig: {
        allowJs: true,
        esModuleInterop: true
      }
    }]
  }
};
