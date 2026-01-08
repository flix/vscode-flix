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
import { findMarkerPosition, getTestDocUri, init } from './util'

suite('GotoDefinitionProvider', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')

  suiteSetup(async () => {
    await init('goto')
  })

  test('Should go to definition of formal parameter', async () => {
    const position = await findMarkerPosition(mainDocUri, 's')
    const location = await testGotoDefinition(mainDocUri, position)
    assert.ok(location)
  })

  test('Should go to definition of match-extracted variable', async () => {
    const position = await findMarkerPosition(mainDocUri, 'r')
    const location = await testGotoDefinition(mainDocUri, position)
    assert.ok(location)
  })

  async function testGotoDefinition(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Location | undefined> {
    const r = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeDefinitionProvider',
      uri,
      position,
    )
    if (r.length === 0) return undefined
    const loc = r[0]
    const targetUri = loc instanceof vscode.Location ? loc.uri : loc.targetUri
    const targetRange = loc instanceof vscode.Location ? loc.range : loc.targetRange
    return new vscode.Location(targetUri, targetRange)
  }
})
