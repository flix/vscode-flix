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
import { activate, getTestDocUri, sleep } from './util'

suite('Source file manipulation', () => {
  const doc1Uri = getTestDocUri('src/Main.flix')

  const doc2Uri = getTestDocUri('src/Area.flix')
  let doc2Content: string

  async function addFile(uri: vscode.Uri, contents: string) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(contents))
  }

  suiteSetup(async () => {
    await activate()
    doc2Content = (await vscode.workspace.fs.readFile(doc2Uri)).toString()
  })
  teardown(async () => {
    // Restore the original content of the file after each test
    await addFile(doc2Uri, doc2Content)
  })

  async function docIsAdded() {
    // If Area.flix is not present in the compiler, then Main.flix will contain a resolution error on the call to area()
    const r = vscode.languages.getDiagnostics(doc1Uri)
    return r.length === 0
  }

  test('Deleted file should be removed', async () => {
    await vscode.workspace.fs.delete(doc2Uri)
    await sleep(1000)
    assert.strictEqual(await docIsAdded(), false)
  })

  test('Created file should be added', async () => {
    await vscode.workspace.fs.delete(doc2Uri)
    await addFile(doc2Uri, doc2Content)
    await sleep(4000)
    assert.strictEqual(await docIsAdded(), true)
  })
})
