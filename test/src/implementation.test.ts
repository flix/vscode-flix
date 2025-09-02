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
import { getTestDocUri, init, normalizeLocation } from './util'

suite('Find implementations', () => {
  const dividableDocUri = getTestDocUri('src/Dividable.flix')

  suiteSetup(async () => {
    await init('implementation')
  })

  test('Should not show anything on empty line', async () => {
    const position = new vscode.Position(0, 0)
    const r = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeImplementationProvider',
      dividableDocUri,
      position,
    )
    assert.deepStrictEqual(r, [])
  })

  async function testImplementations(uri: vscode.Uri, position: vscode.Position, expectedLocations: vscode.Location[]) {
    const r = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeImplementationProvider',
      uri,
      position,
    )

    const actualLocations = r.map(normalizeLocation)

    assert.deepStrictEqual(new Set(actualLocations), new Set(expectedLocations))
  }

  test.skip('Should find Dividable trait implementation', async () => {
    await testImplementations(dividableDocUri, new vscode.Position(1, 6), [
      new vscode.Location(dividableDocUri, new vscode.Range(5, 9, 5, 18)),
    ])
  })
})
