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
import { findMarkerPosition, getTestDocUri, init } from './util'

suite('FindReferencesProvider', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')

  suiteSetup(async () => {
    await init('findReferences')
  })

  test('Should find references to function parameter', async () => {
    const position = await findMarkerPosition(mainDocUri, 's1')
    const locations = await testFindReferences(mainDocUri, position)
    assert.strictEqual(locations.length, 2)
  })

  test('Should find references to function parameter-use', async () => {
    const position = await findMarkerPosition(mainDocUri, 's2')
    const locations = await testFindReferences(mainDocUri, position)
    assert.strictEqual(locations.length, 2)
  })

  test('Should find references to pattern variable', async () => {
    const position = await findMarkerPosition(mainDocUri, 'r1')
    const locations = await testFindReferences(mainDocUri, position)
    assert.strictEqual(locations.length, 3)
  })

  test('Should find references to pattern variable-use', async () => {
    const position = await findMarkerPosition(mainDocUri, 'r2')
    const locations = await testFindReferences(mainDocUri, position)
    assert.strictEqual(locations.length, 3)
  })

  async function testFindReferences(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Location[]> {
    return vscode.commands.executeCommand<vscode.Location[]>('vscode.executeReferenceProvider', uri, position)
  }
})
