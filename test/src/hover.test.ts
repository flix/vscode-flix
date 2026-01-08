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
import { getTestDocUri, init, open } from './util'

suite('Hover info', () => {
  const docUri = getTestDocUri('src/Main.flix')

  suiteSetup(async () => {
    await init('hover')
    await open(docUri)
  })

  test('Should not show anything when hovering on empty line', async () => {
    const position = new vscode.Position(0, 0)
    const r = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', docUri, position)
    assert.strictEqual(r.length, 0)
  })

  /**
   * Returns the given string, `s`, with all newlines replaced by a space.
   */
  function stripNewlines(s: string) {
    return s.replaceAll(/(\r\n|\n|\r)/g, ' ')
  }

  /**
   * Asserts that hovering at the given `position` in the document shows exactly one message, which contains all of the `expectedKeywords` (case-insensitive).
   */
  async function testHoverAtPosition(position: vscode.Position, expectedKeywords: string[]) {
    const r = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', docUri, position)

    assert.strictEqual(r.length, 1)

    const contents = r[0].contents[0] as vscode.MarkdownString
    const actualLower = stripNewlines(contents.value).toLowerCase()
    assert.strictEqual(
      expectedKeywords.every(kw => actualLower.includes(kw.toLowerCase())),
      true,
      `Actual: ${contents.value}\nExpected keywords: ${expectedKeywords.join(', ')}`,
    )
  }

  test('Should show Type when hovering on Unit', async () => {
    const position = new vscode.Position(9, 12)
    await testHoverAtPosition(position, ['Type'])
  })

  test('Should show Eff when hovering on IO', async () => {
    const position = new vscode.Position(9, 19)
    await testHoverAtPosition(position, ['Eff'])
  })

  test('Should show Shape when hovering on Shape.Rectangle instantiation', async () => {
    const position = new vscode.Position(10, 13)
    await testHoverAtPosition(position, ['Shape'])
  })

  test('Should show def when hovering on area()-call', async () => {
    const position = new vscode.Position(10, 12)
    await testHoverAtPosition(position, ['def', 'area', 'Shape'])
  })

  test('Should show doc when hovering on area()-call', async () => {
    const position = new vscode.Position(10, 12)
    await testHoverAtPosition(position, ['area', 'shape', 'pattern'])
  })
})
