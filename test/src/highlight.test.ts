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

suite('Highlight uses', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')
  const areaDocUri = getTestDocUri('src/Area.flix')
  const equatableDocUri = getTestDocUri('src/Equatable.flix')
  const dateDocUri = getTestDocUri('src/Date.flix')
  const dividableDocUri = getTestDocUri('src/Dividable.flix')
  const recordsDocUri = getTestDocUri('src/Records.flix')

  suiteSetup(async () => {
    await init('highlight')
  })

  test('Should not show anything on empty line', async () => {
    const position = new vscode.Position(0, 0)
    const r = await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
      'vscode.executeDocumentHighlights',
      mainDocUri,
      position,
    )
    assert.strictEqual(r, undefined)
  })

  async function testHighlight(uri: vscode.Uri, position: vscode.Position, expectedRanges: vscode.Range[]) {
    const r = await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
      'vscode.executeDocumentHighlights',
      uri,
      position,
    )

    const actualRanges = r.map(h => h.range)

    assert.deepStrictEqual(new Set(actualRanges), new Set(expectedRanges))
  }

  test('Should find highlights of Shape.Circle case', async () => {
    await testHighlight(mainDocUri, new vscode.Position(3, 9), [
      new vscode.Range(3, 9, 3, 22),
      new vscode.Range(12, 46, 12, 58),
      new vscode.Range(17, 17, 17, 29),
    ])
  })
  test('Should find highlights of Shape.Circle case-use', async () => {
    await testHighlight(mainDocUri, new vscode.Position(12, 52), [
      new vscode.Range(3, 9, 3, 22),
      new vscode.Range(12, 46, 12, 58),
      new vscode.Range(17, 17, 17, 29),
    ])
  })
  test('Should find highlights of Shape.Circle case-use from pattern match', async () => {
    await testHighlight(mainDocUri, new vscode.Position(17, 23), [
      new vscode.Range(3, 9, 3, 22),
      new vscode.Range(12, 46, 12, 58),
      new vscode.Range(17, 17, 17, 29),
    ])
  })

  test('Should find highlights of area function', async () => {
    await testHighlight(areaDocUri, new vscode.Position(3, 4), [
      new vscode.Range(3, 4, 3, 8),
      new vscode.Range(12, 39, 12, 43),
    ])
  })
  test('Should find highlights of area function-use', async () => {
    await testHighlight(areaDocUri, new vscode.Position(12, 39), [
      new vscode.Range(3, 4, 3, 8),
      new vscode.Range(12, 39, 12, 43),
    ])
  })

  test('Should find highlights of Equatable.equals signature', async () => {
    await testHighlight(equatableDocUri, new vscode.Position(2, 12), [
      new vscode.Range(2, 12, 2, 18),
      new vscode.Range(9, 41, 9, 57),
      new vscode.Range(22, 4, 22, 20),
      new vscode.Range(29, 4, 29, 20),
      new vscode.Range(36, 8, 36, 24),
      new vscode.Range(43, 8, 43, 24),
    ])
  })
  test('Should find highlights of Equatable.equals signature-use', async () => {
    await testHighlight(equatableDocUri, new vscode.Position(29, 20), [
      new vscode.Range(2, 12, 2, 18),
      new vscode.Range(9, 41, 9, 57),
      new vscode.Range(22, 4, 22, 20),
      new vscode.Range(29, 4, 29, 20),
      new vscode.Range(36, 8, 36, 24),
      new vscode.Range(43, 8, 43, 24),
    ])
  })

  test('Should find highlights of Day type alias', async () => {
    await testHighlight(dateDocUri, new vscode.Position(18, 11), [
      new vscode.Range(18, 11, 18, 14),
      new vscode.Range(21, 23, 21, 26),
    ])
  })

  /////// See https://github.com/flix/flix/issues/8326 ///////
  test.skip('Should find highlights of Aef associated effect', async () => {
    await testHighlight(dividableDocUri, new vscode.Position(6, 9), [
      new vscode.Range(6, 9, 6, 12),
      new vscode.Range(7, 33, 7, 46),
      new vscode.Range(11, 9, 11, 12),
    ])
  })

  test.skip('Should find highlights of DivByZero effect', async () => {
    await testHighlight(dividableDocUri, new vscode.Position(1, 4), [
      new vscode.Range(1, 4, 1, 13),
      new vscode.Range(11, 15, 11, 24),
      new vscode.Range(12, 45, 12, 54),
    ])
  })

  test.skip('Should find highlights of DivByZero.throw operation', async () => {
    await testHighlight(dividableDocUri, new vscode.Position(2, 12), [
      new vscode.Range(2, 12, 2, 17),
      new vscode.Range(13, 23, 13, 38),
    ])
  })
  test.skip('Should find highlights of DivByZero.throw operation-use', async () => {
    await testHighlight(dividableDocUri, new vscode.Position(13, 23), [
      new vscode.Range(2, 12, 2, 17),
      new vscode.Range(13, 23, 13, 38),
    ])
  })
  ////////////////////////////////////////////////////////////

  test('Should find highlights of function parameter', async () => {
    await testHighlight(equatableDocUri, new vscode.Position(6, 19), [
      new vscode.Range(6, 19, 6, 20),
      new vscode.Range(7, 15, 7, 16),
    ])
  })
  test('Should find highlights of function parameter-use', async () => {
    await testHighlight(equatableDocUri, new vscode.Position(7, 15), [
      new vscode.Range(6, 19, 6, 20),
      new vscode.Range(7, 15, 7, 16),
    ])
  })

  test('Should find highlights of match-extracted variable', async () => {
    await testHighlight(equatableDocUri, new vscode.Position(9, 23), [
      new vscode.Range(9, 23, 9, 25),
      new vscode.Range(9, 58, 9, 60),
    ])
  })
  test('Should find highlights of match-extracted variable-use', async () => {
    await testHighlight(equatableDocUri, new vscode.Position(9, 58), [
      new vscode.Range(9, 23, 9, 25),
      new vscode.Range(9, 58, 9, 60),
    ])
  })

  test('Should find highlights of let-bound variable', async () => {
    await testHighlight(equatableDocUri, new vscode.Position(20, 8), [
      new vscode.Range(20, 8, 20, 13),
      new vscode.Range(22, 21, 22, 26),
    ])
  })
  test('Should find highlights of let-bound variable-use', async () => {
    await testHighlight(equatableDocUri, new vscode.Position(22, 21), [
      new vscode.Range(20, 8, 20, 13),
      new vscode.Range(22, 21, 22, 26),
    ])
  })

  test('Should find highlights of record label', async () => {
    await testHighlight(recordsDocUri, new vscode.Position(3, 6), [
      new vscode.Range(2, 13, 2, 14),
      new vscode.Range(2, 48, 2, 49),
      new vscode.Range(3, 6, 3, 7),
      new vscode.Range(13, 14, 13, 15),
      new vscode.Range(15, 7, 15, 8),
      new vscode.Range(15, 14, 15, 15),
      new vscode.Range(15, 8, 15, 9),
      new vscode.Range(15, 15, 15, 16),
    ])
  })
})
