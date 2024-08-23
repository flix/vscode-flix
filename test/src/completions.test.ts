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
import { getTestDocUri, init, open, typeText, addFile } from './util'

suite('Completions', () => {
  const docUri = getTestDocUri('src/Temp.flix')
  const javaMathDocUri = getTestDocUri('src/JavaMath.flix')

  suiteSetup(async () => {
    await init('completions')
  })

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

  test('Should propose completing Math.floor', async () => {
    await open(javaMathDocUri)

    const position = new vscode.Position(5 - 1, 24 - 1)
    const r = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      javaMathDocUri,
      position,
    )

    assert.strictEqual(
      r.items.some(i => i.label === 'floor(arg0: double): double \\ IO'),
      true,
    )
  })

  test('Math.floor completion should have placeholder arg', async () => {
    await open(javaMathDocUri)

    const position = new vscode.Position(5 - 1, 23 - 1)
    const r = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      javaMathDocUri,
      position,
    )

    assert.strictEqual(
      r.items.some(i => (i.insertText as vscode.SnippetString).value === 'floor(${1:arg0})'),
      true,
    )
  })
})
