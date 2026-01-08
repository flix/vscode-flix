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

suite('DocumentHighlightProvider', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')

  suiteSetup(async () => {
    await init('highlight')
  })

  test('Should find highlights of function parameter', async () => {
    const position = await findMarkerPosition(mainDocUri, 's1')
    const highlights = await testHighlight(mainDocUri, position)
    assert.strictEqual(highlights.length, 2)
  })

  test('Should find highlights of function parameter-use', async () => {
    const position = await findMarkerPosition(mainDocUri, 's2')
    const highlights = await testHighlight(mainDocUri, position)
    assert.strictEqual(highlights.length, 2)
  })

  test('Should find highlights of match-extracted variable', async () => {
    const position = await findMarkerPosition(mainDocUri, 'r1')
    const highlights = await testHighlight(mainDocUri, position)
    assert.strictEqual(highlights.length, 3)
  })

  test('Should find highlights of match-extracted variable-use', async () => {
    const position = await findMarkerPosition(mainDocUri, 'r2')
    const highlights = await testHighlight(mainDocUri, position)
    assert.strictEqual(highlights.length, 3)
  })

  test('Should find highlights of let-bound variable', async () => {
    const position = await findMarkerPosition(mainDocUri, 'first1')
    const highlights = await testHighlight(mainDocUri, position)
    assert.strictEqual(highlights.length, 2)
  })

  test('Should find highlights of let-bound variable-use', async () => {
    const position = await findMarkerPosition(mainDocUri, 'first2')
    const highlights = await testHighlight(mainDocUri, position)
    assert.strictEqual(highlights.length, 2)
  })

  async function testHighlight(uri: vscode.Uri, position: vscode.Position): Promise<vscode.DocumentHighlight[]> {
    return vscode.commands.executeCommand<vscode.DocumentHighlight[]>('vscode.executeDocumentHighlights', uri, position)
  }
})
