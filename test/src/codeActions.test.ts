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
import { getTestDocUri, init, open, stringify } from './util'

suite('CodeActionProvider', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')
  const dateDocUri = getTestDocUri('src/Date.flix')

  suiteSetup(async () => {
    await init('codeActions')
  })

  test('Empty line should not suggest code actions', async () => {
    await open(mainDocUri)

    const r = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      mainDocUri,
      new vscode.Range(0, 0, 0, 0),
    )

    assert.strictEqual(r.length, 0)
  })

  test('Should propose using Date.earlierDate def', async () => {
    await testCodeAction(dateDocUri, new vscode.Position(43, 4), ['use', 'earlierDate'])
  })

  test('Should propose using Date.Month enum', async () => {
    await testCodeAction(dateDocUri, new vscode.Position(2, 25), ['use', 'Month'])
  })

  async function testCodeAction(docUri: vscode.Uri, position: vscode.Position, expectedKeywords: string[]) {
    await open(docUri)

    const r = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      docUri,
      new vscode.Range(position, position),
    )

    const action = r.find(a => {
      const titleLower = a.title.toLowerCase()
      return expectedKeywords.every(kw => titleLower.includes(kw.toLowerCase()))
    })
    assert.notStrictEqual(
      action,
      undefined,
      `Code action with keywords "${expectedKeywords.join(', ')}" not found. Instead found: ${stringify(r)}`,
    )
  }
})
