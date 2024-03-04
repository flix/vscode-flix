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
  const doc1Uri = getTestDocUri('src/Temp1.flix')
  const doc1Content = `def foo(): Unit = bar()`

  const doc2Uri = getTestDocUri('src/Temp2.flix')
  const doc2Content = `def bar(): Unit = ()`

  async function addFile(uri: vscode.Uri, contents: string) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(contents))
  }

  suiteSetup(async () => {
    await activate()
    await addFile(doc1Uri, doc1Content)
  })
  suiteTeardown(async () => {
    try {
      await vscode.workspace.fs.delete(doc1Uri)
    } catch {
      // Ignore
    }
  })
  teardown(async () => {
    try {
      await vscode.workspace.fs.delete(doc2Uri)
    } catch {
      // Ignore
    }
  })

  async function docIsAdded() {
    // Wait for the diagnostics to be reported
    // TODO: Do this in a smarter way
    await sleep(1000)

    // If Temp2 is not added, then Temp1 will contain a resolution error on the call to bar()
    const r = vscode.languages.getDiagnostics(doc1Uri)
    return r.length === 0
  }

  test('Created file should be added', async () => {
    await addFile(doc2Uri, doc2Content)
    assert.strictEqual(await docIsAdded(), true)
  })

  test('Deleted file should be removed', async () => {
    await addFile(doc2Uri, doc2Content)
    await vscode.workspace.fs.delete(doc2Uri)
    assert.strictEqual(await docIsAdded(), false)
  })
})
