const { defineConfig } = require('@vscode/test-cli')

module.exports = defineConfig({
  files: ['test/**/*.test.js'],

  mocha: {
    // Downloading compiler takes a long time
    timeout: 60000,
  },
})
