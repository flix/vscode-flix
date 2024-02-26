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

/**
 * Activates the extension in the `testWorkspace` directory and opens the document at `docUri`.
 */
async function activate(docUri) {
  // The extensionId is `publisher.name` from package.json
  const ext = vscode.extensions.getExtension('flix.flix')

  // This includes the time it takes for the compiler to download
  // The time it takes for the compiler to start will be awaited in the first command sent to the extension
  await ext.activate()

  const doc = await vscode.workspace.openTextDocument(docUri)
  await vscode.window.showTextDocument(doc)
}

function getTestDocPath(p) {
  return path.resolve(__dirname, 'testWorkspace', p)
}
function getTestDocUri(p) {
  return vscode.Uri.file(getTestDocPath(p))
}

module.exports = {
  activate,
  getTestDocUri,
}
