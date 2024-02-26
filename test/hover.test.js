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

  test('Hovering on an empty line should not show anything', async () => {
    const position = new vscode.Position(0, 0)
    const r = await vscode.commands.executeCommand('vscode.executeHoverProvider', docUri, position)
    assert.strictEqual(r.length, 0)
  })

  test('Hovering on Unit should show Type', async () => {
    const position = new vscode.Position(17, 12)
    vscode.Hover
    const r = await vscode.commands.executeCommand('vscode.executeHoverProvider', docUri, position)
    assert.strictEqual(r.length, 1)
    assert.strictEqual(r[0].contents[0].value.includes('Type'), true)
  })
})
