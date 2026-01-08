/*
 * Copyright 2024 Holger Dal Mogensen
 * Copyright 2024 Alexander Dybdahl Troelsen
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
import { getTestDocUri, init, normalizeLocation } from './util'

suite('Find references', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')
  const dividableDocUri = getTestDocUri('src/Dividable.flix')
  const areaDocUri = getTestDocUri('src/Area.flix')
  const equatableDocUri = getTestDocUri('src/Equatable.flix')
  const dateDocUri = getTestDocUri('src/Date.flix')

  suiteSetup(async () => {
    await init('findReferences')
  })

  async function testFindReferences(uri: vscode.Uri, position: vscode.Position, expectedLocations: vscode.Location[]) {
    const r = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeReferenceProvider', uri, position)
    const actualLocations = r.map(normalizeLocation)

    assert.deepStrictEqual(new Set(actualLocations), new Set(expectedLocations))
  }

  test('Should find references to Shape.Circle enum case', async () => {
    await testFindReferences(mainDocUri, new vscode.Position(3, 9), [
      new vscode.Location(mainDocUri, new vscode.Range(3, 9, 3, 15)),
      new vscode.Location(areaDocUri, new vscode.Range(5, 13, 5, 25)),
    ])
  })

  test('Should find references to Shape.Circle enum case-use', async () => {
    await testFindReferences(areaDocUri, new vscode.Position(5, 13), [
      new vscode.Location(mainDocUri, new vscode.Range(3, 9, 3, 15)),
      new vscode.Location(areaDocUri, new vscode.Range(5, 13, 5, 25)),
    ])
  })

  test('Should find references to Dividable trait', async () => {
    await testFindReferences(dividableDocUri, new vscode.Position(1, 6), [
      new vscode.Location(dividableDocUri, new vscode.Range(1, 6, 1, 15)),
      new vscode.Location(dividableDocUri, new vscode.Range(5, 9, 5, 18)),
    ])
  })

  test('Should find references to area def', async () => {
    await testFindReferences(areaDocUri, new vscode.Position(3, 4), [
      new vscode.Location(areaDocUri, new vscode.Range(3, 4, 3, 8)),
      new vscode.Location(areaDocUri, new vscode.Range(12, 39, 12, 43)),
      new vscode.Location(mainDocUri, new vscode.Range(10, 12, 10, 16)),
    ])
  })

  test('Should find references to area def-use', async () => {
    await testFindReferences(areaDocUri, new vscode.Position(12, 39), [
      new vscode.Location(areaDocUri, new vscode.Range(3, 4, 3, 8)),
      new vscode.Location(areaDocUri, new vscode.Range(12, 39, 12, 43)),
      new vscode.Location(mainDocUri, new vscode.Range(10, 12, 10, 16)),
    ])
  })

  test('Should find references to Equatable.equals signature', async () => {
    await testFindReferences(equatableDocUri, new vscode.Position(2, 12), [
      new vscode.Location(equatableDocUri, new vscode.Range(2, 12, 2, 18)),
      new vscode.Location(equatableDocUri, new vscode.Range(9, 41, 9, 57)),
      new vscode.Location(equatableDocUri, new vscode.Range(6, 12, 6, 18)),
      new vscode.Location(equatableDocUri, new vscode.Range(15, 12, 15, 18)),
      new vscode.Location(equatableDocUri, new vscode.Range(22, 4, 22, 20)),
      new vscode.Location(equatableDocUri, new vscode.Range(29, 4, 29, 20)),
      new vscode.Location(equatableDocUri, new vscode.Range(36, 8, 36, 24)),
      new vscode.Location(equatableDocUri, new vscode.Range(43, 8, 43, 24)),
    ])
  })

  test('Should find references to Equatable.equals signature-use', async () => {
    await testFindReferences(equatableDocUri, new vscode.Position(29, 14), [
      new vscode.Location(equatableDocUri, new vscode.Range(2, 12, 2, 18)),
      new vscode.Location(equatableDocUri, new vscode.Range(9, 41, 9, 57)),
      new vscode.Location(equatableDocUri, new vscode.Range(22, 4, 22, 20)),
      new vscode.Location(equatableDocUri, new vscode.Range(29, 4, 29, 20)),
      new vscode.Location(equatableDocUri, new vscode.Range(36, 8, 36, 24)),
      new vscode.Location(equatableDocUri, new vscode.Range(43, 8, 43, 24)),
    ])
  })

  test('Should find references to Shape enum', async () => {
    await testFindReferences(mainDocUri, new vscode.Position(2, 5), [
      new vscode.Location(mainDocUri, new vscode.Range(2, 5, 2, 10)),
      new vscode.Location(areaDocUri, new vscode.Range(3, 12, 3, 17)),
    ])
  })

  test('Should find references to Year type alias', async () => {
    await testFindReferences(dateDocUri, new vscode.Position(17, 11), [
      new vscode.Location(dateDocUri, new vscode.Range(17, 11, 17, 15)),
      new vscode.Location(dateDocUri, new vscode.Range(21, 10, 21, 14)),
    ])
  })

  test('Should find references to function parameter', async () => {
    await testFindReferences(equatableDocUri, new vscode.Position(6, 19), [
      new vscode.Location(equatableDocUri, new vscode.Range(6, 19, 6, 20)),
      new vscode.Location(equatableDocUri, new vscode.Range(7, 15, 7, 16)),
    ])
  })

  test('Should find references to function parameter-use', async () => {
    await testFindReferences(equatableDocUri, new vscode.Position(7, 15), [
      new vscode.Location(equatableDocUri, new vscode.Range(6, 19, 6, 20)),
      new vscode.Location(equatableDocUri, new vscode.Range(7, 15, 7, 16)),
    ])
  })

  test('Should find references to match-extracted variable', async () => {
    await testFindReferences(equatableDocUri, new vscode.Position(9, 23), [
      new vscode.Location(equatableDocUri, new vscode.Range(9, 23, 9, 25)),
      new vscode.Location(equatableDocUri, new vscode.Range(9, 58, 9, 60)),
    ])
  })

  test('Should find references to match-extracted variable-use', async () => {
    await testFindReferences(equatableDocUri, new vscode.Position(9, 58), [
      new vscode.Location(equatableDocUri, new vscode.Range(9, 23, 9, 25)),
      new vscode.Location(equatableDocUri, new vscode.Range(9, 58, 9, 60)),
    ])
  })

  test('Should find references to let-bound variable', async () => {
    await testFindReferences(equatableDocUri, new vscode.Position(20, 8), [
      new vscode.Location(equatableDocUri, new vscode.Range(20, 8, 20, 13)),
      new vscode.Location(equatableDocUri, new vscode.Range(22, 21, 22, 26)),
    ])
  })

  test('Should find references to let-bound variable-use', async () => {
    await testFindReferences(equatableDocUri, new vscode.Position(22, 21), [
      new vscode.Location(equatableDocUri, new vscode.Range(20, 8, 20, 13)),
      new vscode.Location(equatableDocUri, new vscode.Range(22, 21, 22, 26)),
    ])
  })
})
