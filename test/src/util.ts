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
 * Activates the extension in the `testWorkspace` directory.
 */
export async function activate() {
  // The extensionId is `publisher.name` from package.json
  const ext = vscode.extensions.getExtension('flix.flix')
  if (ext === undefined) {
    throw new Error('Failed to activate extension')
  }

  // This includes the time it takes for the compiler to download
  // The time it takes for the compiler to start will be awaited in the first command sent to the extension
  await ext.activate()
}

/**
 * Opens the document at `docUri` in the main editor.
 */
export async function open(docUri: vscode.Uri) {
  const doc = await vscode.workspace.openTextDocument(docUri)
  await vscode.window.showTextDocument(doc)
}

function getTestDocPath(p: string) {
  return path.resolve(__dirname, '../testWorkspace', p)
}
export function getTestDocUri(p: string) {
  return vscode.Uri.file(getTestDocPath(p))
}

/**
 * Sleeps for `ms` milliseconds.
 */
export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Waits for the processing of a newly added or deleted file to finish.
 */
async function processFileChange() {
  // Wait for the file system watcher to pick up the change
  await sleep(1000)

  // Wait for the compiler to process the change
  await vscode.commands.executeCommand('flix.allJobsFinished')

  // Wait for the diagnostics to be updated
  await sleep(1000)
}

/**
 * Add a file with the given `uri` and `content`, and wait for the compiler to process this.
 */
export async function addFile(uri: vscode.Uri, content: string) {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content))
  await processFileChange()
}

/**
 * Copy the file from `from` to `to`, and wait for the compiler to process this.
 */
export async function copyFile(from: vscode.Uri, to: vscode.Uri) {
  await vscode.workspace.fs.copy(from, to)
  await processFileChange()
}

/**
 * Delete the file at `uri`, and wait for the compiler to process this.
 *
 * Throws if the file does not exist.
 */
export async function deleteFile(uri: vscode.Uri) {
  await vscode.workspace.fs.delete(uri)
  await processFileChange()
}
