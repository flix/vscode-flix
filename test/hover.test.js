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

const assert = require('assert')
const vscode = require('vscode')
const { getTestDocUri, activate } = require('./util')

suite('Hover info', () => {
  let docUri
  suiteSetup(async () => {
    docUri = getTestDocUri('Main.flix')
    await activate(docUri)
  })

  test('None', async () => {
    const position = new vscode.Position(0, 0)
    const r = await vscode.commands.executeCommand('vscode.executeHoverProvider', docUri, position)
    assert.deepStrictEqual(r, [])
  })

  test('Unit type', async () => {
    const position = new vscode.Position(17, 12)
    vscode.Hover
    const r = await vscode.commands.executeCommand('vscode.executeHoverProvider', docUri, position)
    assert.deepStrictEqual(r, [
      new vscode.Hover(
        new vscode.MarkdownString('This string is not compared by `assert.deepStrictEqual()`'),
        new vscode.Range(17, 12, 17, 16),
      ),
    ])
    assert.strictEqual(r[0].contents[0].value, '\n```flix\nType\n```\n')
  })
})
