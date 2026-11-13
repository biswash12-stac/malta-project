// Jest runs only the tests in tests/jest. The node:test suite (npm test) keeps running tests/*.test.ts.
// npm run test:jest starts Node with --experimental-vm-modules, because MongoDB driver 7.8 loads
// "os" with a dynamic import(). Without the flag Jest blocks that import, and every connection fails
// with "Missing required sub-document 'driver'".
/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/jest"],
  // Runs before each test file loads the app, so tests never see the real values in .env.
  setupFiles: ["<rootDir>/tests/jest/setup-env.ts"],
  // ts-jest doesn't support TypeScript 7, so SWC strips the types without checking them.
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript" }, target: "es2022" },
        module: { type: "commonjs" },
      },
    ],
  },
  // envalid ships only as an ES module, which Jest can't load on Node 22, so SWC converts it too.
  // Add any other ES-module-only package to this list if Jest reports "Must use import".
  transformIgnorePatterns: ["/node_modules/(?!(envalid)/)"],
  // The source imports "./app.js" (NodeNext style). Jest needs the path without .js to find app.ts.
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  // In-memory MongoDB can take a while to start the first time.
  testTimeout: 30_000,
};
