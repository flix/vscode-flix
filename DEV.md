# Development

Run `npm install` to ensure that the required dependencies are installed.

## Testing

The test suite can be run via `npm test`, or via the 
[Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
for more granular control. When using the Extension Test Runner, use `npm run watch` to make sure the TypeScript 
files are compiled on save.

To run the tests with a custom build of the compiler, place the `flix.jar` file into the `test/activeWorkspace/` directory.

## Debugging

Open the project in Visual Studio Code and find the menu `Run -> Start Debugging
(F5)`. This will initiate a debugging scheme called `Client + Server` which you
can change in the *Run* command palette (usually Ctrl+Shift+D). If you make
changes to the code you need to restart the `Launch Client` (see *Call Stack*).

You can set breakpoints in the compiled code, e.g. `server/out/server.js`.

## Code Style

All code should be formatted with Prettier and checked with ESLint with respect 
to the config files (`.prettierrc` and `.eslintrc.json`) found in the root of the
project. This is checked for all pull requests to the repository.

If you are using Visual Studio Code you can make sure this will happen
automatically on save by installing the recommended extensions:
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

Alternatively, you can run the terminal commands:
- Check formatting: `npx prettier . --check`
- Fix formatting: `npx prettier . --write`
- Check linting: `npx eslint .`

## Commits

This project loosely uses the format from
[conventionalcommits.org](https://www.conventionalcommits.org/) which groups
commits into categories.

Pull requests should be squash merged with a commit message category in keeping
with its overall contribution.

## Contributing

- Every PR must state that you agree to release your contributions under the
  Apache 2.0 license. You can achieve this by either adding yourself to
  AUTHORS.md or alternatively by stating it explicitly in the PR.

- This is the repository for Flix Visual Studio Code plugin. Not for the Flix
  compiler itself. Issues should be filed against the appropriate repository. If
  in doubt, please use the main Flix repository for reporting bugs.

## Known Issues

- Can't connect to debug target
  - This can happen if the file that gets opened in the debug windows isn't with
    a `.flix` extension
- While our long-term goal is full LSP support, we are not yet ready to
  test/support clients other than Visual Studio Code. If you want to add support
  for editor X please reach out to us.
