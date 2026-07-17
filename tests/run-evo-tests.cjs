// CJS wrapper to load TypeScript test via ts-node (bypasses Node v25 ESM issues)
require("ts-node/register/transpile-only");

// Set up mocha globals
const Mocha = require("mocha");
const mocha = new Mocha({ timeout: 1000000 });

mocha.addFile("./tests/evo.ts");

mocha.run(function (failures) {
  process.exitCode = failures > 0 ? 1 : 0;
});