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
 * Replaces the entire content of the given document with `newContent`, saves, and waits for the compiler to process.
 */
export async function replaceDocumentContent(docUri: vscode.Uri, newContent: string) {
  const doc = await vscode.workspace.openTextDocument(docUri)
  await vscode.window.showTextDocument(doc)
  await awaitCheck(async () => {
    const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
    const edit = new vscode.WorkspaceEdit()
    edit.replace(docUri, fullRange, newContent)
    await vscode.workspace.applyEdit(edit)
    await doc.save()
  })
}

/**
 * Get the URI of the test document at `p` relative to the active workspace, e.g. `src/Main.flix`.
 */
export function getTestDocUri(p: string) {
  // The only way to produce a URI with the same path as the ones generated by vscode (lowercase drive letter).
  return vscode.Uri.file(vscode.Uri.file(path.resolve(__dirname, '../activeWorkspace', p)).fsPath)
}

/**
 * Sleeps for `ms` milliseconds.
 */
export async function sleep(ms: number) {
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
export async function copyDirContents(from: vscode.Uri, to: vscode.Uri) {
  const contents = await vscode.workspace.fs.readDirectory(from)
  const names = contents.map(([name, _]) => name)

  const uris = names.map(name => ({ from: vscode.Uri.joinPath(from, name), to: vscode.Uri.joinPath(to, name) }))

  await Promise.allSettled(uris.map(({ from, to }) => vscode.workspace.fs.copy(from, to, { overwrite: true })))
}

/**
 * Copy the file from `from` to `to`, and wait for the compiler to process this.
 */
export async function copyFile(from: vscode.Uri, to: vscode.Uri) {
  await awaitCheck(async () => {
    await vscode.workspace.fs.copy(from, to, { overwrite: true })
  })
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
 * Normalize the given `uri` to a canonical form.
 */
function normalizeUri(uri: vscode.Uri) {
  // Strip out unnecessary information such as _formatted
  return vscode.Uri.parse(uri.toString())
}

/**
 * Returns the given `location` (which can be either a {@linkcode vscode.Location} or {@linkcode vscode.LocationLink})
 * as a {@linkcode vscode.Location} in a canonical form.
 */
export function normalizeLocation(location: vscode.Location | vscode.LocationLink) {
  if (location instanceof vscode.Location) {
    return new vscode.Location(normalizeUri(location.uri), location.range)
  } else {
    return new vscode.Location(normalizeUri(location.targetUri), location.targetRange)
  }
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
