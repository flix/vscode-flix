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
import { getTestDocUri, activate, stringify } from './util'

suite('Highlight uses', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')
  const areaDocUri = getTestDocUri('src/Area.flix')
  const equatableDocUri = getTestDocUri('src/Equatable.flix')
  const dateDocUri = getTestDocUri('src/Date.flix')
  const dividableDocUri = getTestDocUri('src/Dividable.flix')
  const recordsDocUri = getTestDocUri('src/Records.flix')

  suiteSetup(async () => {
    await activate('highlight')
  })

  test('Empty line should not show anything', async () => {
    const position = new vscode.Position(0, 0)
    const r = (await vscode.commands.executeCommand(
      'vscode.executeDocumentHighlights',
      mainDocUri,
      position,
    )) as vscode.DocumentHighlight[]
    assert.strictEqual(r, undefined)
  })

  async function testGotoDefinition(uri: vscode.Uri, position: vscode.Position, expectedRanges: vscode.Range[]) {
    const r = (await vscode.commands.executeCommand(
      'vscode.executeDocumentHighlights',
      uri,
      position,
    )) as vscode.DocumentHighlight[]

    const actualRanges = r.map(h => h.range)

    // TODO: Require that they match exactly (https://github.com/flix/flix/issues/7742)
    for (const expectedRange of expectedRanges) {
      assert.ok(
        actualRanges.some(r => r.isEqual(expectedRange)),
        `Expected range ${stringify(expectedRange)} not found in ${stringify(actualRanges)}`,
      )
    }
  }

  test('Find Shape.Circle case highlights', async () => {
    await testGotoDefinition(mainDocUri, new vscode.Position(3, 9), [
      new vscode.Range(new vscode.Position(3, 9), new vscode.Position(3, 22)),
      new vscode.Range(new vscode.Position(12, 52), new vscode.Position(12, 58)),
      new vscode.Range(new vscode.Position(17, 17), new vscode.Position(17, 29)),
    ])
  })
  test('Find Shape.Circle case-use highlights', async () => {
    await testGotoDefinition(mainDocUri, new vscode.Position(12, 52), [
      new vscode.Range(new vscode.Position(3, 9), new vscode.Position(3, 22)),
      new vscode.Range(new vscode.Position(12, 52), new vscode.Position(12, 58)),
      new vscode.Range(new vscode.Position(17, 17), new vscode.Position(17, 29)),
    ])
  })
  test('Find Shape.Circle case-use from pattern match highlights', async () => {
    await testGotoDefinition(mainDocUri, new vscode.Position(17, 23), [
      new vscode.Range(new vscode.Position(3, 9), new vscode.Position(3, 22)),
      new vscode.Range(new vscode.Position(12, 52), new vscode.Position(12, 58)),
      new vscode.Range(new vscode.Position(17, 17), new vscode.Position(17, 29)),
    ])
  })

  test('Find area function highlights', async () => {
    await testGotoDefinition(areaDocUri, new vscode.Position(3, 4), [
      new vscode.Range(new vscode.Position(3, 4), new vscode.Position(3, 8)),
      new vscode.Range(new vscode.Position(12, 39), new vscode.Position(12, 43)),
    ])
  })
  test('Find area function-use highlights', async () => {
    await testGotoDefinition(areaDocUri, new vscode.Position(12, 39), [
      new vscode.Range(new vscode.Position(3, 4), new vscode.Position(3, 8)),
      new vscode.Range(new vscode.Position(12, 39), new vscode.Position(12, 43)),
    ])
  })

  test('Find Equatable.equals signature highlights', async () => {
    await testGotoDefinition(equatableDocUri, new vscode.Position(2, 12), [
      new vscode.Range(new vscode.Position(2, 12), new vscode.Position(2, 18)),
      new vscode.Range(new vscode.Position(9, 51), new vscode.Position(9, 57)),
      new vscode.Range(new vscode.Position(22, 14), new vscode.Position(22, 20)),
      new vscode.Range(new vscode.Position(29, 14), new vscode.Position(29, 20)),
      new vscode.Range(new vscode.Position(36, 18), new vscode.Position(36, 24)),
    ])
  })
  test('Find Equatable.equals signature-use highlights', async () => {
    await testGotoDefinition(equatableDocUri, new vscode.Position(29, 20), [
      new vscode.Range(new vscode.Position(2, 12), new vscode.Position(2, 18)),
      new vscode.Range(new vscode.Position(9, 51), new vscode.Position(9, 57)),
      new vscode.Range(new vscode.Position(22, 14), new vscode.Position(22, 20)),
      new vscode.Range(new vscode.Position(29, 14), new vscode.Position(29, 20)),
      new vscode.Range(new vscode.Position(36, 18), new vscode.Position(36, 24)),
    ])
  })

  test('Find Day type alias highlights', async () => {
    await testGotoDefinition(dateDocUri, new vscode.Position(18, 11), [
      new vscode.Range(new vscode.Position(18, 11), new vscode.Position(18, 14)),
      new vscode.Range(new vscode.Position(21, 23), new vscode.Position(21, 26)),
    ])
  })

  test('Find Aef associated effect highlights', async () => {
    await testGotoDefinition(dividableDocUri, new vscode.Position(6, 9), [
      new vscode.Range(new vscode.Position(6, 9), new vscode.Position(6, 12)),
      new vscode.Range(new vscode.Position(7, 33), new vscode.Position(7, 46)),
      new vscode.Range(new vscode.Position(11, 9), new vscode.Position(11, 12)),
    ])
  })

  test('Find DivByZero effect highlights', async () => {
    await testGotoDefinition(dividableDocUri, new vscode.Position(1, 4), [
      new vscode.Range(new vscode.Position(1, 4), new vscode.Position(1, 13)),
      new vscode.Range(new vscode.Position(11, 15), new vscode.Position(11, 24)),
      new vscode.Range(new vscode.Position(12, 45), new vscode.Position(12, 54)),
    ])
  })

  test('Find DivByZero.throw operation highlights', async () => {
    await testGotoDefinition(dividableDocUri, new vscode.Position(2, 12), [
      new vscode.Range(new vscode.Position(2, 12), new vscode.Position(2, 17)),
      new vscode.Range(new vscode.Position(13, 23), new vscode.Position(13, 38)),
    ])
  })
  test('Find DivByZero.throw operation-use highlights', async () => {
    await testGotoDefinition(dividableDocUri, new vscode.Position(13, 23), [
      new vscode.Range(new vscode.Position(2, 12), new vscode.Position(2, 17)),
      new vscode.Range(new vscode.Position(13, 23), new vscode.Position(13, 38)),
    ])
  })

  test('Find function parameter highlights', async () => {
    await testGotoDefinition(equatableDocUri, new vscode.Position(6, 19), [
      new vscode.Range(new vscode.Position(6, 19), new vscode.Position(6, 20)),
      new vscode.Range(new vscode.Position(7, 15), new vscode.Position(7, 16)),
    ])
  })
  test('Find function parameter-use highlights', async () => {
    await testGotoDefinition(equatableDocUri, new vscode.Position(7, 15), [
      new vscode.Range(new vscode.Position(6, 19), new vscode.Position(6, 20)),
      new vscode.Range(new vscode.Position(7, 15), new vscode.Position(7, 16)),
    ])
  })

  test('Find match-extracted variable highlights', async () => {
    await testGotoDefinition(equatableDocUri, new vscode.Position(9, 23), [
      new vscode.Range(new vscode.Position(9, 23), new vscode.Position(9, 25)),
      new vscode.Range(new vscode.Position(9, 58), new vscode.Position(9, 60)),
    ])
  })
  test('Find match-extracted variable-use highlights', async () => {
    await testGotoDefinition(equatableDocUri, new vscode.Position(9, 58), [
      new vscode.Range(new vscode.Position(9, 23), new vscode.Position(9, 25)),
      new vscode.Range(new vscode.Position(9, 58), new vscode.Position(9, 60)),
    ])
  })

  test('Find let-bound variable highlights', async () => {
    await testGotoDefinition(equatableDocUri, new vscode.Position(20, 8), [
      new vscode.Range(new vscode.Position(20, 8), new vscode.Position(20, 13)),
      new vscode.Range(new vscode.Position(22, 21), new vscode.Position(22, 26)),
    ])
  })
  test('Find let-bound variable-use highlights', async () => {
    await testGotoDefinition(equatableDocUri, new vscode.Position(22, 21), [
      new vscode.Range(new vscode.Position(20, 8), new vscode.Position(20, 13)),
      new vscode.Range(new vscode.Position(22, 21), new vscode.Position(22, 26)),
    ])
  })

  test('Find record label highlights', async () => {
    await testGotoDefinition(recordsDocUri, new vscode.Position(3, 6), [
      new vscode.Range(new vscode.Position(2, 13), new vscode.Position(2, 14)),
      new vscode.Range(new vscode.Position(2, 48), new vscode.Position(2, 49)),
      new vscode.Range(new vscode.Position(3, 6), new vscode.Position(3, 7)),
      new vscode.Range(new vscode.Position(13, 14), new vscode.Position(13, 15)),
      new vscode.Range(new vscode.Position(15, 7), new vscode.Position(15, 8)),
      new vscode.Range(new vscode.Position(15, 14), new vscode.Position(15, 15)),
    ])
  })
})
