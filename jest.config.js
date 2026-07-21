/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // e2e/ is Playwright's directory - Playwright tests cannot run under Jest.
  // *.integration.test.ts needs a real Postgres, so it is excluded from the
  // default run and executed via `npm run test:integration` (see package.json).
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
    '\\.integration\\.test\\.ts$',
  ],
  collectCoverageFrom: ['lib/**/*.ts', 'app/api/**/*.ts', 'src/**/*.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', moduleResolution: 'node' } }],
  },
}
