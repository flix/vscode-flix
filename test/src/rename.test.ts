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
import { getTestDocUri, init, open } from './util'

suite('RenameProvider', () => {
  const equatableDocUri = getTestDocUri('src/Equatable.flix')

  suiteSetup(async () => {
    await init('rename')
  })

  async function testRename(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Range[]> {
    await open(uri)
    const newName = 'NewName'
    const r = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
      'vscode.executeDocumentRenameProvider',
      uri,
      position,
      newName,
    )

    const entries = r.entries()
    for (const [_uri, edits] of entries) {
      for (const edit of edits) {
        assert.strictEqual(edit.newText, newName)
      }
    }

    return entries.flatMap(([_uri, edits]) => edits.map(e => e.range))
  }

  async function findMarkerPosition(uri: vscode.Uri, tag?: string): Promise<vscode.Position> {
    const document = await vscode.workspace.openTextDocument(uri)
    const text = document.getText()
    const marker = tag ? `/*!${tag}*/` : '/*!*/'
    const index = text.indexOf(marker)
    if (index === -1) {
      throw new Error(`Marker ${marker} not found in ${uri.fsPath}`)
    }
    // Marker is placed one space after the position we care about
    // So target position is 2 characters before marker start
    const targetIndex = index - 2
    return document.positionAt(targetIndex)
  }

  test('Should rename function parameter', async () => {
    const position = await findMarkerPosition(equatableDocUri, 'xvar')
    const ranges = await testRename(equatableDocUri, position)
    assert.strictEqual(ranges.length, 2)
  })
  test('Should rename function parameter-use', async () => {
    const position = await findMarkerPosition(equatableDocUri, 'xuse')
    const ranges = await testRename(equatableDocUri, position)
    assert.strictEqual(ranges.length, 2)
  })

  test('Should rename let-bound variable', async () => {
    const position = await findMarkerPosition(equatableDocUri, 'firstvar')
    const ranges = await testRename(equatableDocUri, position)
    assert.strictEqual(ranges.length, 2)
  })
  test('Should rename let-bound variable-use', async () => {
    const position = await findMarkerPosition(equatableDocUri, 'firstuse')
    const ranges = await testRename(equatableDocUri, position)
    assert.strictEqual(ranges.length, 2)
  })
})
