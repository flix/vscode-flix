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

import * as assert from 'assert'
import * as vscode from 'vscode'
import { activate, addFile, deleteFile, getTestDocUri } from './util'

suite('File manipulation', () => {
  const doc1Uri = getTestDocUri('src/Main.flix')

  const doc2Uri = getTestDocUri('src/Area.flix')
  let doc2Content: Uint8Array

  const fpkgUri = getTestDocUri('lib/circleArea.fpkg')
  let fpkgContent: Uint8Array

  suiteSetup(async () => {
    await activate('files')
    doc2Content = await vscode.workspace.fs.readFile(doc2Uri)
    fpkgContent = await vscode.workspace.fs.readFile(fpkgUri)
  })
  setup(async () => {
    // Restore the original content of the files before each test
    await addFile(doc2Uri, doc2Content)
    await addFile(fpkgUri, fpkgContent)
  })

  async function workspaceValid() {
    // If all files are not present in the compiler, then Main.flix will contain a resolution error
    const r = [...vscode.languages.getDiagnostics(doc1Uri), ...vscode.languages.getDiagnostics(doc2Uri)]
    return r.length === 0
  }

  test('Deleted source-file should be removed', async () => {
    await deleteFile(doc2Uri)
    assert.strictEqual(await workspaceValid(), false)
  })

  test('Created source-file should be added', async () => {
    await deleteFile(doc2Uri)
    await addFile(doc2Uri, doc2Content)
    assert.strictEqual(await workspaceValid(), true)
  })

  test('Deleted fpkg-file should be removed', async () => {
    await deleteFile(fpkgUri)
    assert.strictEqual(await workspaceValid(), false)
  })

  test('Created fpkg-file should be added', async () => {
    await deleteFile(fpkgUri)
    await addFile(fpkgUri, fpkgContent)
    assert.strictEqual(await workspaceValid(), true)
  })

  // TODO: Test for jar-file. This file is locked by the process, so it cannot be deleted and added again.
})
