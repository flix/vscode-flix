# Development

Run `npm install` to ensure that the required dependencies are installed.

## Debugging

Open the project in Visual Studio Code and find the menu `Run -> Start Debugging
(F5)`. This will initiate a debugging scheme called `Client + Server` which you
can change in the *Run* command palette (usually Ctrl+Shift+D). If you make
changes to the code you need to restart the `Launch Client` (see *Call Stack*).

You can set breakpoints in the compiled code, e.g. `server/out/server.js`.

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
