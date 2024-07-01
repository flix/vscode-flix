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
import { init, addFile, deleteFile, getTestDocUri } from './util'

suite('File manipulation', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')
  const areaDocUri = getTestDocUri('src/Area.flix')
  const fpkgUri = getTestDocUri('lib/circleArea.fpkg')

  setup(async () => {
    // Restore the original content of the files before each test
    await init('files')
  })

  async function workspaceValid() {
    // If all files are not present in the compiler, then Main.flix will contain a resolution error
    const r = [...vscode.languages.getDiagnostics(mainDocUri), ...vscode.languages.getDiagnostics(areaDocUri)]
    return r.length === 0
  }

  test('Should remove deleted source-file', async () => {
    await deleteFile(areaDocUri)
    assert.strictEqual(await workspaceValid(), false)
  })

  test('Should add created source-file', async () => {
    const content = await vscode.workspace.fs.readFile(areaDocUri)
    await deleteFile(areaDocUri)
    await addFile(areaDocUri, content)
    assert.strictEqual(await workspaceValid(), true)
  })

  test('Should remove deleted fpkg-file', async () => {
    await deleteFile(fpkgUri)
    assert.strictEqual(await workspaceValid(), false)
  })

  test('Should add created fpkg-file', async () => {
    const content = await vscode.workspace.fs.readFile(fpkgUri)
    await deleteFile(fpkgUri)
    await addFile(fpkgUri, content)
    assert.strictEqual(await workspaceValid(), true)
  })

  // TODO: Test for jar-file. This file is locked by the process, so it cannot be deleted and added again.
})
