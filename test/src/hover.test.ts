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
import { getTestDocUri, activate, open, copyFile, tryDeleteFile } from './util'

suite('Hover info', () => {
  const docUri = getTestDocUri('src/Main.flix')

  const brokenDocUriLatent = getTestDocUri('latent/Broken.flix')
  const brokenDocUri = getTestDocUri('src/Broken.flix')

  suiteSetup(async () => {
    await activate()
    await open(docUri)
  })
  teardown(async () => {
    await tryDeleteFile(brokenDocUri)
  })

  test('Hovering on an empty line should not show anything', async () => {
    const position = new vscode.Position(0, 0)
    const r = (await vscode.commands.executeCommand('vscode.executeHoverProvider', docUri, position)) as vscode.Hover[]
    assert.strictEqual(r.length, 0)
  })

  /**
   * Returns the given string, `s`, with all newlines replaced by a space.
   */
  function stripNewlines(s: string) {
    return s.replaceAll(/(\r\n|\n|\r)/g, ' ')
  }

  /**
   * Asserts that hovering at the given `position` in the document shows exactly one message, which contains the `expected` string.
   */
  async function testHoverAtPosition(position: vscode.Position, expected: string) {
    const r = (await vscode.commands.executeCommand('vscode.executeHoverProvider', docUri, position)) as vscode.Hover[]

    assert.strictEqual(r.length, 1)

    const contents = r[0].contents[0] as vscode.MarkdownString
    const actual = stripNewlines(contents.value)
    assert.strictEqual(actual.includes(expected), true, `Actual: ${actual}\nExpected: ${expected}`)
  }

  test('Hovering on Unit should show Type', async () => {
    const position = new vscode.Position(9, 12)
    await testHoverAtPosition(position, 'Type')
  })

  test('Hovering on IO should show Eff', async () => {
    const position = new vscode.Position(9, 19)
    await testHoverAtPosition(position, 'Eff')
  })

  test('Hovering on Shape.Rectangle instantiation should show Shape', async () => {
    const position = new vscode.Position(10, 13)
    await testHoverAtPosition(position, 'Shape')
  })

  test('Hovering on area()-call should show def', async () => {
    const position = new vscode.Position(10, 12)
    await testHoverAtPosition(position, 'def area(s: Shape): Int32')
  })

  test('Hovering on area()-call should show doc', async () => {
    const position = new vscode.Position(10, 12)
    await testHoverAtPosition(
      position,
      'Computes the area of the given shape using pattern matching and basic arithmetic.',
    )
  })

  test('Hovering on area()-call in broken project should still show def', async () => {
    await copyFile(brokenDocUriLatent, brokenDocUri)

    const position = new vscode.Position(10, 12)
    await testHoverAtPosition(position, '(Information may not be current)')
    await testHoverAtPosition(position, 'def area(s: Shape): Int32')
  })
})
