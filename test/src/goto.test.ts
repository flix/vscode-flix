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

suite('Goto definition', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')
  const areaDocUri = getTestDocUri('src/Area.flix')
  const equatableDocUri = getTestDocUri('src/Equatable.flix')
  const rewindDocUri = getTestDocUri('src/Rewind.flix')

  suiteSetup(async () => {
    await init('goto')
  })

  test('Going to definition of empty line should not show anything', async () => {
    const position = new vscode.Position(0, 0)
    const r = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeDefinitionProvider',
      mainDocUri,
      position,
    )
    assert.strictEqual(r.length, 0)
  })

  async function testGotoDefinition(
    uri: vscode.Uri,
    position: vscode.Position,
    expectedUri: vscode.Uri,
    expectedRange: vscode.Range,
  ) {
    const r = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeDefinitionProvider',
      uri,
      position,
    )

    assert.strictEqual(r.length, 1)
    const location = r[0]

    const receivedUri = location instanceof vscode.Location ? location.uri : location.targetUri
    const receivedRange = location instanceof vscode.Location ? location.range : location.targetRange

    assert.strictEqual(receivedUri.toString(), expectedUri.toString())
    assert.deepStrictEqual(receivedRange, expectedRange)
  }

  test('Go to area definition', async () => {
    await testGotoDefinition(mainDocUri, new vscode.Position(10, 12), areaDocUri, new vscode.Range(3, 4, 3, 8))
  })

  test('Go to Equatable.equals definition', async () => {
    await testGotoDefinition(
      equatableDocUri,
      new vscode.Position(9, 51),
      equatableDocUri,
      new vscode.Range(2, 12, 2, 18),
    )
  })

  test('Go to function parameter definition', async () => {
    await testGotoDefinition(
      equatableDocUri,
      new vscode.Position(7, 15),
      equatableDocUri,
      new vscode.Range(6, 19, 6, 20),
    )
  })

  test('Go to match-extracted variable definition', async () => {
    await testGotoDefinition(
      equatableDocUri,
      new vscode.Position(9, 58),
      equatableDocUri,
      new vscode.Range(9, 23, 9, 25),
    )
  })

  test('Go to let-bound variable definition', async () => {
    await testGotoDefinition(
      equatableDocUri,
      new vscode.Position(22, 21),
      equatableDocUri,
      new vscode.Range(20, 8, 20, 13),
    )
  })

  test.skip('Go to case definition', async () => {
    await testGotoDefinition(areaDocUri, new vscode.Position(12, 50), mainDocUri, new vscode.Range(4, 9, 4, 22))
  })

  test.skip('Go to case definition from match-case', async () => {
    await testGotoDefinition(areaDocUri, new vscode.Position(6, 19), mainDocUri, new vscode.Range(4, 9, 4, 22))
  })

  test('Go to enum definition', async () => {
    await testGotoDefinition(areaDocUri, new vscode.Position(3, 12), mainDocUri, new vscode.Range(1, 0, 6, 1))
  })

  test('Go to effect definition', async () => {
    await testGotoDefinition(rewindDocUri, new vscode.Position(14, 30), rewindDocUri, new vscode.Range(2, 4, 2, 10))
  })

  test('Go to type-variable definition', async () => {
    await testGotoDefinition(
      equatableDocUri,
      new vscode.Position(2, 22),
      equatableDocUri,
      new vscode.Range(1, 16, 1, 17),
    )
  })
})
