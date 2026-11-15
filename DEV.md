# Development

## Contributing

- Every PR must state that you agree to release your contributions under the
  Apache 2.0 license. You can achieve this by either adding yourself to
  AUTHORS.md or alternatively by stating it explicitly in the PR.

## Pull Requests

- The PR title must start with one of `chore: `, `ci: `, `docs: `, `feat: `,
  `fix: `, `refactor: `, `style: `, or `test: `. This is checked for all pull
  requests to the repository.

- Pull requests should be squash merged.

## Testing

To run the tests with a custom build of the compiler, place the `flix.jar` file
into both the `test/activeWorkspace/` and `test/dependencyWorkspace/`
directories.

## Known Issues

- Can't connect to debug target
  - This can happen if the file that gets opened in the debug window does not
    have a `.flix` extension.
