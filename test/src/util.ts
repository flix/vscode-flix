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
 * How long to wait for the compiler to stay quiescent before considering a batch of workspace file
 * changes fully settled. Must exceed the reconciliation debounce in the client's file watchers
 * (`scheduleReconciliation`, currently 300ms), which can enqueue a follow-up check *after* the
 * change's initial check has already gone idle. See {@linkcode settleAfterChange}.
 */
const RECONCILE_SETTLE_MS = 500

/**
 * Activates the extension and swaps the active workspace to the contents of the given test workspace
 * directory, waiting deterministically for the compiler to finish compiling the result.
 *
 * @param testWorkspaceName The name of the workspace directory to copy, e.g. `codeActions`.
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

  vscode.commands.executeCommand('workbench.action.closeAllEditors')
  const activeWorkspaceUri = vscode.workspace.workspaceFolders![0].uri

  // The `flix.checkCount` synchronization used below only works once the extension is running.
  //
  // On the very first suite the extension has not started yet: there is no check baseline to capture
  // and no file-system watcher to report the changes below, so the copied files are instead picked
  // up by the initial workspace scan performed when `ext.activate()` runs. On every later suite the
  // extension is already active and we synchronize on the checks its watchers trigger.
  const wasActive = ext.isActive

  // Remove the previous suite's files. When the extension is already running, wait for the compiler
  // to observe the removals *before* copying the new files. Otherwise VS Code can coalesce a
  // delete-then-create of the same path into a single change event, which the file-system watcher
  // does not handle — leaving the compiler with stale file contents.
  const clearBaseline = wasActive ? await getCheckCount() : 0
  const removedFlixFiles = await clearDir(activeWorkspaceUri)
  if (wasActive && removedFlixFiles > 0) {
    await settleAfterChange(clearBaseline)
  }

  // Copy in the new workspace.
  const copyBaseline = wasActive ? await getCheckCount() : 0
  const testWorkspacePath = path.resolve(__dirname, '../testWorkspaces', testWorkspaceName)
  await copyDirContents(vscode.Uri.file(testWorkspacePath), activeWorkspaceUri)

  // Ensure the extension is active. On the first suite this starts (and, on a cold CI run,
  // downloads) the compiler and triggers the initial scan+compile of the files copied above.
  await ext.activate()

  // Wait for the compiler to finish compiling the new workspace and go idle.
  await settleAfterChange(copyBaseline)
}

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
 * The suite must call {@linkcode teardown2} with the same name when it is done, since no file-system
 * watcher will ever report these files as gone.
 *
 * @param testWorkspaceName The name of the workspace directory to load, e.g. `codeActions`.
 */
export async function init2(testWorkspaceName: string) {
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

  // Ensure the extension is active. On the first suite this starts (and, on a cold CI run,
  // downloads) the compiler. `ext.activate()` only resolves once the server has been told to start,
  // so the notifications sent below are ordered after it.
  const wasActive = ext.isActive
  await ext.activate()

  // Whatever is in the active workspace belongs to a previous suite, which copied it there with
  // `init`, or to an earlier test run which left it behind. The compiler is given these files when
  // it scans the workspace, so make it forget them: the fixture loaded below is the whole program.
  const workspaceUris = await findWorkspaceFiles()

  if (!wasActive && workspaceUris.length > 0) {
    // On the first suite the compiler is only starting up, and it is handed the files above once it
    // connects — which happens after `activate()` returns, and hence after the removals below are
    // sent. Wait for the check that scan triggers, so that it cannot undo them. A check is
    // guaranteed here precisely because the scan found files.
    await waitForCheckSince(0)
    await awaitIdle()
  }

  const baseline = await getCheckCount()

  for (const uri of workspaceUris) {
    await vscode.commands.executeCommand('flix.remUri', uri.toString())
  }
  for (const uri of fixtureUris) {
    await addFileToCompiler(uri, await readFileContent(uri))
  }

  // Open the documents here, so the `didOpen` each of them triggers is handled as part of the setup
  // rather than in the middle of a test.
  await Promise.all(fixtureUris.map(uri => vscode.workspace.openTextDocument(uri)))

  // Wait for the compiler to finish compiling the new workspace and go idle. Adding and removing
  // files are priority jobs, so the compiler runs a check once it has processed all of them — unless
  // there was nothing to do, as for a workspace whose files are all loaded by the tests themselves.
  if (workspaceUris.length + fixtureUris.length > 0) {
    await waitForCheckSince(baseline)
  }
  await awaitIdle()
}

/**
 * Blanks every file loaded by {@linkcode init2} from the given test workspace directory, so that
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
export async function teardown2(testWorkspaceName: string) {
  const fixtureUris = await findFixtureFiles(testWorkspaceName)
  if (fixtureUris.length === 0) {
    return
  }

  const baseline = await getCheckCount()
  for (const uri of fixtureUris) {
    await addFileToCompiler(uri, '')
  }

  // Adding a file is a priority job, so the compiler runs a check once it has processed all of them.
  await waitForCheckSince(baseline)
  await awaitIdle()
}

/**
 * Loads the file at `uri` into the compiler with its content as it is on disk, without copying it
 * anywhere, and waits for the compiler to process it.
 *
 * As with {@linkcode init2}, no file-system watcher will ever report this file as gone, so the
 * caller has to {@linkcode blankFile} it again once it should no longer be part of the program.
 */
export async function loadFile(uri: vscode.Uri) {
  const src = await readFileContent(uri)
  await awaitCheck(() => addFileToCompiler(uri, src))
}

/**
 * Empties the content the compiler holds for the file at `uri`, so that it no longer contributes
 * anything to the program, and waits for the compiler to process it.
 *
 * The file itself is left untouched on disk.
 */
export async function blankFile(uri: vscode.Uri) {
  await awaitCheck(() => addFileToCompiler(uri, ''))
}

/**
 * Hands the file at `uri` to the compiler with `src` as its content, without waiting for the
 * compiler to process it.
 */
async function addFileToCompiler(uri: vscode.Uri, src: string) {
  await vscode.commands.executeCommand('flix.addUri', uri.toString(), src)
}

/**
 * Finds the `.flix` files of the active workspace, i.e. the ones the extension hands to the compiler
 * when it scans the workspace.
 */
async function findWorkspaceFiles(): Promise<vscode.Uri[]> {
  const activeWorkspaceFolder = vscode.workspace.workspaceFolders![0]
  // NB: Must match `getFlixGlobPattern` in `client/src/util/workspace.ts`.
  const pattern = new vscode.RelativePattern(activeWorkspaceFolder, '{*.flix,src/**/*.flix,test/**/*.flix}')

  return vscode.workspace.findFiles(pattern)
}

/**
 * Returns the content of the file at `uri` as a string.
 */
async function readFileContent(uri: vscode.Uri): Promise<string> {
  return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8')
}

/**
 * Finds the `.flix` files directly in the given test workspace directory, which are the ones
 * {@linkcode init2} loads.
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
 * Recursively deletes all test-owned files (matched by extension) from `uri`, always keeping
 * `.gitkeep` and `flix.jar`.
 *
 * @returns the number of `.flix` files that were removed, so the caller can tell whether the
 * deletion will trigger a recompile to wait for.
 */
async function clearDir(uri: vscode.Uri): Promise<number> {
  const contents = await vscode.workspace.fs.readDirectory(uri)

  // Recurse into subdirectories
  const dirs = contents.filter(([_, type]) => type === vscode.FileType.Directory)
  const dirUris = dirs.map(([name, _]) => vscode.Uri.joinPath(uri, name))
  const removedInSubdirs = await Promise.all(dirUris.map(clearDir))

  const files = contents.filter(([_, type]) => type !== vscode.FileType.Directory)
  const fileNames = files.map(([name, _]) => name)

  // Be careful, and only delete files with known extensions
  const extensionsToDelete = ['flix', 'toml', 'jar', 'fpkg', 'txt']

  // Always keep .gitkeep and flix.jar
  const namesToKeep = ['.gitkeep', 'flix.jar']

  const namesToDelete = fileNames.filter(
    name => !namesToKeep.includes(name) && extensionsToDelete.includes(name.split('.').at(-1)),
  )
  const urisToDelete = namesToDelete.map(name => vscode.Uri.joinPath(uri, name))
  await Promise.allSettled(urisToDelete.map(uri => vscode.workspace.fs.delete(uri)))

  const removedHere = namesToDelete.filter(name => name.endsWith('.flix')).length
  return removedHere + removedInSubdirs.reduce((sum, n) => sum + n, 0)
}

/**
 * Opens the document at `docUri` in the main editor.
 */
export async function open(docUri: vscode.Uri) {
  const doc = await vscode.workspace.openTextDocument(docUri)
  await vscode.window.showTextDocument(doc)
}

/**
 * Types the given `text` in the editor at the current position.
 */
export async function typeText(text: string) {
  await awaitCheck(async () => {
    await vscode.commands.executeCommand('type', { text })
    await vscode.window.activeTextEditor.document.save()
  })
}

/**
 * Get the URI of the test document at `p` relative to the active workspace, e.g. `src/Main.flix`.
 */
export function getTestDocUri(p: string) {
  return getFileUri(path.resolve(__dirname, '../activeWorkspace', p))
}

/**
 * Get the URI of the file at `p` in the test workspace directory `testWorkspaceName`, e.g.
 * `Main.flix` in `codeActions`.
 *
 * Unlike {@linkcode getTestDocUri}, this points at the file where it lives in `testWorkspaces`,
 * which is where {@linkcode init2} leaves it.
 */
export function getFixtureDocUri(testWorkspaceName: string, p: string) {
  return getFileUri(path.resolve(__dirname, '../testWorkspaces', testWorkspaceName, p))
}

/**
 * Get the URI of the file at the absolute path `p`.
 */
function getFileUri(p: string) {
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
 * Waits for the compiler to finish reacting to a batch of workspace file changes (the setup in
 * {@linkcode init}) and reach a stable idle state, given the {@linkcode getCheckCount} value
 * observed *before* the changes were made.
 *
 * Unlike a fixed sleep, this is anchored to observable compiler progress:
 *
 * 1. {@linkcode waitForCheckSince} blocks until the file-system watcher has fired and a check has
 *    completed, so we never sample idle against stale, pre-change state.
 * 2. We then repeatedly drain the queue ({@linkcode awaitIdle}) until the observed check count stops
 *    advancing across a full {@linkcode RECONCILE_SETTLE_MS} window. A create/delete schedules a
 *    debounced reconciliation that can enqueue a *follow-up* check (e.g. when VS Code delivers a
 *    single folder-level event instead of per-file events), so returning on the first idle would be
 *    premature.
 */
async function settleAfterChange(baseline: number) {
  await waitForCheckSince(baseline)
  for (;;) {
    await awaitIdle()
    const count = await getCheckCount()
    await sleep(RECONCILE_SETTLE_MS)
    if ((await getCheckCount()) === count) {
      return
    }
  }
}

/**
 * Runs the filesystem `mutation`, then waits until the `lsp/check` it triggers has finished and the
 * compiler is idle.
 *
 * This is the synchronization primitive for in-test file mutations (those that run while the
 * extension is already active and idle), and it is race-free because it baselines the check count
 * *before* the mutation:
 *
 * - The leading {@linkcode waitForCheckSince} proves the file-system watcher fired and a check
 *   completed, so we never sample idle against stale, pre-change state (the old `sleep(1000)` was a
 *   guess that the watcher had fired).
 * - The trailing {@linkcode awaitIdle} proves the queue drained. At that point all
 *   `publishDiagnostics` for this check have already been applied to VS Code's diagnostics
 *   collection, because the server sends them before the idle signal on the same ordered channel
 *   (so the old trailing `sleep(1000)` is unnecessary).
 */
async function awaitCheck<T>(mutation: () => Promise<T>): Promise<T> {
  const before = await getCheckCount()
  const result = await mutation()
  await waitForCheckSince(before)
  await awaitIdle()
  return result
}

/**
 * Add a file with the given `uri` and `content`, and wait for the compiler to process this.
 */
export async function addFile(uri: vscode.Uri, content: string | Uint8Array) {
  await awaitCheck(async () => {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content))
  })
}

/**
 * Copies the contents of the given folder `from` to the folder `to`, leaving non-overlapping files
 * intact.
 *
 * Does not wait for the compiler to react — callers synchronize via {@linkcode settleAfterChange}
 * (workspace setup) or {@linkcode awaitCheck} (in-test mutations).
 */
async function copyDirContents(from: vscode.Uri, to: vscode.Uri) {
  const contents = await vscode.workspace.fs.readDirectory(from)
  const names = contents.map(([name, _]) => name)

  const uris = names.map(name => ({ from: vscode.Uri.joinPath(from, name), to: vscode.Uri.joinPath(to, name) }))

  await Promise.allSettled(uris.map(({ from, to }) => vscode.workspace.fs.copy(from, to, { overwrite: true })))
}

/**
 * Delete the file at `uri`, and wait for the compiler to process this.
 *
 * Throws if the file does not exist.
 */
export async function deleteFile(uri: vscode.Uri) {
  await awaitCheck(async () => {
    await vscode.workspace.fs.delete(uri)
  })
}

/**
 * Tries to delete the file at `uri`, but does nothing if the file does not exist.
 */
export async function tryDeleteFile(uri: vscode.Uri) {
  try {
    await deleteFile(uri)
  } catch {
    // File does not exist - no need to delete
  }
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
