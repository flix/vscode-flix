const { defineConfig } = require('@vscode/test-cli')

/**
 * The desired version of VS Code can be optionally passed as an environment variable, for example:
 * - `stable`
 * - `1.80.0`
 */
const version = process.env.VSCODE_VERSION

const mocha = {
  // Downloading compiler takes a long time
  timeout: 120000,

  // Only highlight tests taking more than 30s
  slow: 30000,

  color: true,

  allowUncaught: false,
}

/**
 * Each entry is launched as its own VS Code instance, with its own extension host and therefore its
 * own Flix compiler process. A suite which needs a workspace of its own — rather than the shared,
 * initially empty one the bulk of the suites mutate — gets an entry here.
 */
module.exports = defineConfig([
  {
    label: 'main',
    version,
    // Only the suites directly in `test/out`; `test/out/isolated` belongs to the entries below.
    files: ['test/out/*.test.js'],
    workspaceFolder: 'test/activeWorkspace/',
    mocha,
    env: {
      NODE_OPTIONS: '--unhandled-rejections=strict',
    },
  },
  {
    label: 'dependencies',
    version,
    files: ['test/out/isolated/dependencies.test.js'],
    // A real project layout — a `flix.toml` and a `src` directory — checked in as it stands. The
    // compiler is started against it, so the manifest is in place before the first check, which is
    // the point: the suite is about a dependency declared there being part of the program.
    workspaceFolder: 'test/dependencyWorkspace/',
    mocha,
    env: {
      NODE_OPTIONS: '--unhandled-rejections=strict',
    },
  },
])
