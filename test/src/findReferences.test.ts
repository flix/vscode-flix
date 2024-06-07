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
import { getTestDocUri, init } from './util'

suite('Find references', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')
  const areaDocUri = getTestDocUri('src/Area.flix')

  suiteSetup(async () => {
    await init('findReferences')
  })

  async function testFindReferences(uri: vscode.Uri, position: vscode.Position, expectedRanges: vscode.Range[]) {
    const r = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeReferenceProvider', uri, position)

    const actualRanges = r.map(h => h.range)

    assert.deepStrictEqual(actualRanges.sort(), expectedRanges.sort())
  }

  test.skip('Should find references to enum case', async () => {
    await testFindReferences(mainDocUri, new vscode.Position(3, 9), [
      new vscode.Range(3, 9, 3, 22),
      new vscode.Range(5, 13, 5, 25),
    ])
  })

  test('Should find references to def', async () => {
    await testFindReferences(areaDocUri, new vscode.Position(3, 4), [
      new vscode.Range(3, 4, 3, 8),
      new vscode.Range(12, 39, 12, 43),
      new vscode.Range(10, 12, 10, 16),
    ])
  })
})
