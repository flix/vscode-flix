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
import { getTestDocUri, activate } from './util'

suite('Find references', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')
  const areaDocUri = getTestDocUri('src/Area.flix')

  suiteSetup(async () => {
    await activate('findReferences')
  })

  test('Should find references to enum case', async () => {
    const position = new vscode.Position(3, 9)
    const r = (await vscode.commands.executeCommand(
      'vscode.executeReferenceProvider',
      mainDocUri,
      position,
    )) as vscode.Location[]

    assert.strictEqual(r.length, 2)

    const mainReference = r.find(l => l.uri.path.endsWith(mainDocUri.path))
    const areaReference = r.find(l => l.uri.path.endsWith(areaDocUri.path))

    assert.notStrictEqual(mainReference, undefined)
    assert.notStrictEqual(areaReference, undefined)

    assert.deepStrictEqual(mainReference?.range, new vscode.Range(3, 9, 3, 22))
    assert.deepStrictEqual(areaReference?.range, new vscode.Range(5, 13, 5, 25))
  })

  test('Should find references to def', async () => {
    const position = new vscode.Position(3, 4)
    const r = (await vscode.commands.executeCommand(
      'vscode.executeReferenceProvider',
      areaDocUri,
      position,
    )) as vscode.Location[]

    assert.strictEqual(r.length, 3)

    const defReference = r.find(l => l.uri.path.endsWith(areaDocUri.path) && l.range.start.line === 3)
    const testReference = r.find(l => l.uri.path.endsWith(areaDocUri.path) && l.range.start.line === 12)
    const mainReference = r.find(l => l.uri.path.endsWith(mainDocUri.path))

    assert.deepStrictEqual(defReference?.range, new vscode.Range(3, 4, 3, 8))
    assert.deepStrictEqual(testReference?.range, new vscode.Range(12, 39, 12, 43))
    assert.deepStrictEqual(mainReference?.range, new vscode.Range(10, 12, 10, 16))
  })
})
