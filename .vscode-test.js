const { defineConfig } = require('@vscode/test-cli')

/**
 * The desired version of VS Code can be optionally passed as an environment variable, for example:
 * - `stable`
 * - `1.80.0`
 */
const version = process.env.VSCODE_VERSION

module.exports = defineConfig({
  version,
  files: ['test/out/**/*.test.js'],
  workspaceFolder: 'test/testWorkspace',

  mocha: {
    // Downloading compiler takes a long time
    timeout: 120000,
    color: true,
  },
})
