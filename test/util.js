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

const path = require('path')
const vscode = require('vscode')

let doc
let editor

/**
 * Activates the extension in the `testWorkspace` directory and opens the document at `docUri`.
 */
async function activate(docUri) {
  vscode.workspace.workspaceFolders = []
  vscode.workspace.updateWorkspaceFolders(0, 0, { uri: getTestWorkspaceUri() })

  // The extensionId is `publisher.name` from package.json
  const ext = vscode.extensions.getExtension('flix.flix')
  await ext.activate()

  // Wait for activation, compiler download and compiler initialization
  // TODO: Signal when extension is ready
  await sleep(20000)

  doc = await vscode.workspace.openTextDocument(docUri)
  editor = await vscode.window.showTextDocument(doc)
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getTestWorkspacePath() {
  return path.resolve(__dirname, 'testWorkspace')
}
function getTestWorkspaceUri() {
  return vscode.Uri.file(getTestWorkspacePath())
}
function getTestDocPath(p) {
  return path.resolve(getTestWorkspacePath(), p)
}
function getTestDocUri(p) {
  return vscode.Uri.file(getTestDocPath(p))
}

module.exports = {
  activate,
  getTestDocUri,
}
