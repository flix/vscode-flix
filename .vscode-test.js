const { defineConfig } = require('@vscode/test-cli')

module.exports = defineConfig({
  files: ['test/out/**/*.test.js'],
  workspaceFolder: 'test/testWorkspace',

  mocha: {
    // Downloading compiler takes a long time
    timeout: 120000,
  },
})
