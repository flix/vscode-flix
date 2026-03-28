import * as vscode from 'vscode'

/**
 * Whether the extension is running in project mode (a workspace folder is open)
 * or single-file mode (a standalone `.flix` file with no folder).
 *
 * Returns a fresh value each call, so it reflects workspace changes (e.g. if
 * VS Code reloads after the user opens a folder).
 */
export function isProjectMode(): boolean {
  return (vscode.workspace.workspaceFolders?.length ?? 0) > 0
}

/**
 * Glob patterns scoped to the first workspace folder.
 *
 * These are functions (not module-level constants) so that evaluation is
 * deferred until call-time inside `activate()`. At module-load time
 * `workspaceFolders` may be undefined (single-file mode).
 *
 * All callers run after `activate()`, where a workspace folder is guaranteed
 * in project mode. In single-file mode these functions must not be called —
 * file discovery uses open-document events instead.
 */
export function getFlixGlobPattern() {
  return new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], '{*.flix,src/**/*.flix,test/**/*.flix}')
}
export function getFpkgGlobPattern() {
  return new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], 'lib/**/*.fpkg')
}
export function getJarGlobPattern() {
  return new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], 'lib/**/*.jar')
}
export function getFlixTomlGlobPattern() {
  return new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], 'flix.toml')
}
