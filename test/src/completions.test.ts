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
import { getTestDocUri, init, open, typeText, addFile, deleteFile, copyFile } from './util'

suite('Completions', () => {
  const docUri = getTestDocUri('src/Temp.flix')
  let tempDocUri: vscode.Uri | null = null

  suiteSetup(async () => {
    await init('completions')
  })

  teardown(async () => {
    if (tempDocUri !== null) {
      await deleteFile(tempDocUri)
    }
  })

  /**
   * Determines if there is a completion suggestion at the `cursor` in the file `src/fileName`.
   *
   * @param fileName name of flix file we're testing. Must include the `.flix` extension.
   * @param cursor the position of the cursor.
   * @param predicate the predicate by which we determine if a completion is valid.
   * @returns `true` if there is a completion suggestion at `cursor` which satisfies `predicate`.
   */
  async function validCompletionExists(
    fileName: string,
    cursor: vscode.Position,
    predicate: (item: vscode.CompletionItem) => boolean,
  ): Promise<boolean> {
    // Setup file
    const latentUri = getTestDocUri(`latent/${fileName}`)
    const srcUri = getTestDocUri(`src/${fileName}`)

    tempDocUri = srcUri
    await copyFile(latentUri, srcUri)

    await open(srcUri)

    const r = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      srcUri,
      cursor,
    )

    return r.items.some(predicate)
  }

  test('Should propose completing mod', async () => {
    await addFile(docUri, '')
    await open(docUri)
    await typeText('mo')

    const position = new vscode.Position(0, 2)
    const r = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      docUri,
      position,
    )

    assert.strictEqual(
      r.items.some(i => i.label === 'mod'),
      true,
    )
  })

  suite('Java Methods', () => {
    test('Should complete Java static method', async () => {
      const cursor = new vscode.Position(5 - 1, 23 - 1)
      const pred = item => item.label === 'floor(arg0: double): double \\ IO'
      assert.strictEqual(await validCompletionExists('JavaMath.flix', cursor, pred), true)
    })

    test('Should complete Java method with snippet placeholder arg for static method', async () => {
      const cursor = new vscode.Position(5 - 1, 23 - 1)
      const pred = item => (item.insertText as vscode.SnippetString).value === 'floor(${1:arg0})'
      assert.strictEqual(await validCompletionExists('JavaMath.flix', cursor, pred), true)
    })

    test('Should complete Java method with snippet placeholder args for static method', async () => {
      const cursor = new vscode.Position(9 - 1, 23 - 1)
      const pred = item => (item.insertText as vscode.SnippetString).value === 'max(${1:arg0}, ${2:arg1})'
      assert.strictEqual(await validCompletionExists('JavaMath.flix', cursor, pred), true)
    })

    test('Should complete Java non-static method', async () => {
      const cursor = new vscode.Position(8 - 1, 18 - 1)
      const pred = item => item.label === 'append(arg0: String): StringBuilder \\ IO'
      assert.strictEqual(await validCompletionExists('JavaStringBuilder.flix', cursor, pred), true)
    })

    test('Should complete Java method with snipper placeholder arg for non-static method', async () => {
      const cursor = new vscode.Position(8 - 1, 18 - 1)
      const pred = item => (item.insertText as vscode.SnippetString).value === 'append(${1:arg0})'
      assert.strictEqual(await validCompletionExists('JavaStringBuilder.flix', cursor, pred), true)
    })
  })
})
