/*
 * Copyright 2024 Holger Dal Mogensen
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as path from 'path'
import * as vscode from 'vscode'

/**
 * The maximum time to wait for a filesystem change to trigger an `lsp/check` before falling back to
 * {@linkcode awaitIdle}. Generous on purpose: every mutation in the suite triggers a check, so this
 * should never be hit in practice — it only prevents a hang if a change unexpectedly produces no
 * check (e.g. the compiler is still downloading on a cold CI run).
 */
const CHECK_TIMEOUT_MS = 20000

/**
 * Activates the extension and loads the contents of the given test workspace directory into the
 * compiler directly, without touching the file system.
 *
 * Every `.flix` file directly in the directory is handed to the compiler by URI and content via the
 * `flix.addUri` test command, so the files are compiled where they live in `testWorkspaces` — use
 * {@linkcode getFixtureDocUri} to refer to them. Nothing is copied into the active workspace, and
 * since nothing changes on disk, no file-system watcher is involved.
 *
 * The directory therefore holds plain files rather than a workspace layout: no `flix.toml`, and no
 * `src` directory. Files in a subdirectory are not loaded — see {@linkcode loadFile}.
 *
 * The suite must call {@linkcode teardown} with the same name when it is done, since no file-system
 * watcher will ever report these files as gone.
 *
 * @param testWorkspaceName The name of the workspace directory to load, e.g. `codeActions`.
 */
export async function init(testWorkspaceName: string) {
  // Show errors in the console
  // TODO: Fail tests if an error message is displayed
  vscode.window.showErrorMessage = (message: string) => {
    throw new Error(`Error message displayed: ${message}`)
  }

  // The extensionId is `publisher.name` from package.json
  const ext = vscode.extensions.getExtension('flix.flix')
  if (ext === undefined) {
    throw new Error('Failed to activate extension')
  }

  await vscode.commands.executeCommand('workbench.action.closeAllEditors')

  const fixtureUris = await findFixtureFiles(testWorkspaceName)

  if (!ext.isActive) {
    // Every suite which puts files in the active workspace deletes them again, so it is only left
    // dirty by an interrupted run. Clean it before the extension starts, so that the compiler never
    // hears about those files: making it forget them afterwards would race with the workspace scan,
    // which is only enqueued once the compiler connects — that is, after `activate()` has returned.
    await deleteWorkspaceFiles()
  }

  // Ensure the extension is active. On the first suite this starts (and, on a cold CI run,
  // downloads) the compiler. `ext.activate()` only resolves once the server has been told to start,
  // so the notifications sent below are ordered after it.
  await ext.activate()

  for (const uri of fixtureUris) {
    await addFileToCompiler(uri, await readFileContent(uri))
  }

  // Open the documents here, so the `didOpen` each of them triggers is handled as part of the setup
  // rather than in the middle of a test.
  await Promise.all(fixtureUris.map(uri => vscode.workspace.openTextDocument(uri)))

  await awaitIdle()
}

/**
 * Blanks every file loaded by {@linkcode init} from the given test workspace directory, so that
 * they no longer contribute anything to the program, and waits for the compiler to finish
 * recompiling.
 *
 * Since the files are compiled where they live in `testWorkspaces`, no file-system watcher will ever
 * report them as gone, so a suite has to clean up after itself — otherwise its definitions would
 * still be part of the program compiled by the next suite. Only the content held by the compiler is
 * emptied; the files on disk are left untouched.
 *
 * @param testWorkspaceName The name of the workspace directory which was loaded, e.g. `codeActions`.
 */
export async function teardown(testWorkspaceName: string) {
  for (const uri of await findFixtureFiles(testWorkspaceName)) {
    await addFileToCompiler(uri, '')
  }
  await awaitIdle()
}

/**
 * Loads the file at `uri` into the compiler with its content as it is on disk, without copying it
 * anywhere, and waits for the compiler to process it.
 *
 * As with {@linkcode init}, no file-system watcher will ever report this file as gone, so the
 * caller has to {@linkcode blankFile} it again once it should no longer be part of the program.
 */
export async function loadFile(uri: vscode.Uri) {
  await addFileToCompiler(uri, await readFileContent(uri))
  await awaitIdle()
}

/**
 * Empties the content the compiler holds for the file at `uri`, so that it no longer contributes
 * anything to the program, and waits for the compiler to process it.
 *
 * The file itself is left untouched on disk.
 */
export async function blankFile(uri: vscode.Uri) {
  await addFileToCompiler(uri, '')
  await awaitIdle()
}

/**
 * Hands the file at `uri` to the compiler with `src` as its content, without waiting for the
 * compiler to process it.
 *
 * The notification this sends and the one {@linkcode awaitIdle} sends travel the same ordered
 * connection, and the server enqueues the resulting job as it handles the notification. Waiting for
 * the compiler to go idle afterwards therefore covers this file — no check has to be counted, as it
 * does for a change the extension only hears about through a file-system watcher.
 */
async function addFileToCompiler(uri: vscode.Uri, src: string) {
  await vscode.commands.executeCommand('flix.addUri', uri.toString(), src)
}

/**
 * Deletes the files of the active workspace which the extension would hand to the compiler when it
 * scans the workspace.
 *
 * Must only be called while the extension is not running: there is no file-system watcher to report
 * the deletions then, which is the point — the compiler is never told about these files at all.
 */
async function deleteWorkspaceFiles() {
  const activeWorkspaceFolder = vscode.workspace.workspaceFolders![0]
  // NB: Must match `getFlixGlobPattern` and `getFpkgGlobPattern` in `client/src/util/workspace.ts`.
  const pattern = new vscode.RelativePattern(
    activeWorkspaceFolder,
    '{*.flix,src/**/*.flix,test/**/*.flix,lib/**/*.fpkg}',
  )

  const uris = await vscode.workspace.findFiles(pattern)
  await Promise.all(uris.map(uri => vscode.workspace.fs.delete(uri)))
}

/**
 * Returns the content of the file at `uri` as a string.
 */
async function readFileContent(uri: vscode.Uri): Promise<string> {
  return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8')
}

/**
 * Finds the `.flix` files directly in the given test workspace directory, which are the ones
 * {@linkcode init} loads.
 *
 * Subdirectories are left alone, so that a fixture which must not be part of the program from the
 * start can be put in one, and loaded by the test itself with {@linkcode loadFile}.
 */
async function findFixtureFiles(testWorkspaceName: string): Promise<vscode.Uri[]> {
  const dirUri = getFileUri(path.resolve(__dirname, '../testWorkspaces', testWorkspaceName))
  const contents = await vscode.workspace.fs.readDirectory(dirUri)

  return contents
    .filter(([name, type]) => type !== vscode.FileType.Directory && name.endsWith('.flix'))
    .map(([name, _]) => vscode.Uri.joinPath(dirUri, name))
}

/**
 * Types the given `text` in the editor at the current position, and waits for the compiler to
 * process it.
 *
 * The document is deliberately not saved: the extension sends the compiler the content of the
 * editor, so the change reaches it either way, and leaving the file on disk alone means the caller
 * can type into a fixture without modifying it.
 */
export async function typeText(text: string) {
  await awaitCheck(async () => {
    await vscode.commands.executeCommand('type', { text })
  })
}

/**
 * Get the URI of the file at `p` in the test workspace directory `testWorkspaceName`, e.g.
 * `Main.flix` in `codeActions`.
 *
 * This points at the file where it lives in `testWorkspaces`, which is where {@linkcode init}
 * leaves it.
 */
export function getFixtureDocUri(testWorkspaceName: string, p: string) {
  return getFileUri(path.resolve(__dirname, '../testWorkspaces', testWorkspaceName, p))
}

/**
 * Get the URI of the file at the absolute path `p`.
 */
export function getFileUri(p: string) {
  // The only way to produce a URI with the same path as the ones generated by vscode (lowercase drive letter).
  return vscode.Uri.file(vscode.Uri.file(p).fsPath)
}

/**
 * Sleeps for `ms` milliseconds.
 */
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Returns the number of `lsp/check` responses the extension has observed since startup.
 *
 * Backed by the `flix.checkCount` test command, which is incremented once per check response —
 * before the corresponding idle signal.
 */
async function getCheckCount(): Promise<number> {
  return (await vscode.commands.executeCommand<number>('flix.checkCount')) ?? 0
}

/**
 * Waits until the observed check count exceeds `since`, i.e. an `lsp/check` has completed.
 *
 * Resolves early (with a warning) after {@linkcode CHECK_TIMEOUT_MS} so a no-op change cannot hang
 * the suite; the subsequent {@linkcode awaitIdle} still guarantees correctness in that case.
 */
async function waitForCheckSince(since: number) {
  const deadline = Date.now() + CHECK_TIMEOUT_MS
  while ((await getCheckCount()) <= since) {
    if (Date.now() > deadline) {
      console.warn(`waitForCheckSince: no lsp/check observed within ${CHECK_TIMEOUT_MS}ms (count still ${since})`)
      return
    }
    await sleep(25)
  }
}

/**
 * Waits until the compiler is idle (all queued jobs finished).
 */
async function awaitIdle() {
  await vscode.commands.executeCommand('flix.allJobsFinished')
}

/**
 * Runs the `mutation`, then waits until the `lsp/check` it triggers has finished and the compiler is
 * idle.
 *
 * This is the synchronization primitive for changes the extension only hears about through a
 * file-system watcher or an editor, which fire at a time of their own choosing — unlike a file
 * handed to the compiler directly, for which waiting for idle is enough. It is race-free because it
 * baselines the check count *before* the mutation:
 *
 * - The leading {@linkcode waitForCheckSince} proves the file-system watcher fired and a check
 *   completed, so we never sample idle against stale, pre-change state (the old `sleep(1000)` was a
 *   guess that the watcher had fired).
 * - The trailing {@linkcode awaitIdle} proves the queue drained. At that point all
 *   `publishDiagnostics` for this check have already been applied to VS Code's diagnostics
 *   collection, because the server sends them before the idle signal on the same ordered channel
 *   (so the old trailing `sleep(1000)` is unnecessary).
 */
export async function awaitCheck<T>(mutation: () => Promise<T>): Promise<T> {
  const before = await getCheckCount()
  const result = await mutation()
  await waitForCheckSince(before)
  await awaitIdle()
  return result
}

/**
 * Pretty print the given `val` as a JSON string.
 */
export function stringify(val: unknown): string {
  return JSON.stringify(val, null, 2)
}

/**
 * Finds a marker in the document and returns the position 2 characters before it.
 * The marker should be placed one space after the position of interest.
 */
export async function findMarkerPosition(uri: vscode.Uri, tag?: string): Promise<vscode.Position> {
  const document = await vscode.workspace.openTextDocument(uri)
  const text = document.getText()
  const marker = tag ? '/*!' + tag + '*/' : '/*!*/'
  const index = text.indexOf(marker)
  if (index === -1) {
    throw new Error('Marker ' + marker + ' not found in ' + uri.fsPath)
  }
  // Marker is placed one space after the position we care about
  // So target position is 2 characters before marker start
  const targetIndex = index - 2
  return document.positionAt(targetIndex)
}
