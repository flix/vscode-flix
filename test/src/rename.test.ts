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

suite('Rename', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')
  const areaDocUri = getTestDocUri('src/Area.flix')
  const equatableDocUri = getTestDocUri('src/Equatable.flix')
  const dateDocUri = getTestDocUri('src/Date.flix')
  const recordsDocUri = getTestDocUri('src/Records.flix')

  suiteSetup(async () => {
    await init('rename')
  })

  test('Should fail to rename empty line', async () => {
    await open(mainDocUri)
    const position = new vscode.Position(0, 0)
    const newName = 'NewName'
    assert.rejects(async () => {
      await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
        'vscode.executeDocumentRenameProvider',
        mainDocUri,
        position,
        newName,
      )
    })
  })

  async function testRename(
    uri: vscode.Uri,
    position: vscode.Position,
    expectedRanges: [vscode.Uri, vscode.Range[]][],
  ) {
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

    const actualRangesString: [string, vscode.Range[]][] = entries.map(([uri, edit]) => [
      uri.toString(),
      edit.map(r => r.range),
    ])
    const expectedRangesString: [string, vscode.Range[]][] = expectedRanges.map(([uri, edit]) => [uri.toString(), edit])

    assert.deepStrictEqual(new Set(actualRangesString), new Set(expectedRangesString))
  }

  /////// See https://github.com/flix/flix/issues/8355 ///////
  test.skip('Should rename Shape.Circle case', async () => {
    await testRename(mainDocUri, new vscode.Position(3, 9), [
      [mainDocUri, [new vscode.Range(3, 9, 3, 15), new vscode.Range(12, 52, 12, 58), new vscode.Range(17, 17, 17, 29)]],
      [areaDocUri, [new vscode.Range(5, 13, 5, 25)]],
    ])
  })
  test.skip('Should rename Shape.Circle case-use', async () => {
    await testRename(mainDocUri, new vscode.Position(12, 52), [
      [mainDocUri, [new vscode.Range(3, 9, 3, 15), new vscode.Range(12, 52, 12, 58), new vscode.Range(17, 17, 17, 29)]],
      [areaDocUri, [new vscode.Range(5, 13, 5, 25)]],
    ])
  })
  test.skip('Should rename Shape.Circle case-use from pattern match', async () => {
    await testRename(mainDocUri, new vscode.Position(17, 23), [
      [mainDocUri, [new vscode.Range(3, 9, 3, 15), new vscode.Range(12, 52, 12, 58), new vscode.Range(17, 17, 17, 29)]],
      [areaDocUri, [new vscode.Range(5, 13, 5, 25)]],
    ])
  })
  ////////////////////////////////////////////////////////////

  // Skipped since renaming of functions is currently unsupported
  test.skip('Should rename area function', async () => {
    await testRename(areaDocUri, new vscode.Position(3, 4), [
      [areaDocUri, [new vscode.Range(3, 4, 3, 8), new vscode.Range(12, 39, 12, 43)]],
      [mainDocUri, [new vscode.Range(10, 12, 10, 16)]],
    ])
  })

  // Skipped since renaming of functions is currently unsupported
  test.skip('Should rename area function-use', async () => {
    await testRename(areaDocUri, new vscode.Position(12, 39), [
      [areaDocUri, [new vscode.Range(3, 4, 3, 8), new vscode.Range(12, 39, 12, 43)]],
      [mainDocUri, [new vscode.Range(10, 12, 10, 16)]],
    ])
  })

  // Skipped since renaming of functions is currently unsupported
  test.skip('Should rename Day type alias', async () => {
    await testRename(dateDocUri, new vscode.Position(18, 11), [
      [dateDocUri, [new vscode.Range(18, 11, 18, 14), new vscode.Range(21, 23, 21, 26)]],
    ])
  })

  test('Should rename function parameter', async () => {
    await testRename(equatableDocUri, new vscode.Position(6, 19), [
      [equatableDocUri, [new vscode.Range(6, 19, 6, 20), new vscode.Range(7, 15, 7, 16)]],
    ])
  })
  test('Should rename function parameter-use', async () => {
    await testRename(equatableDocUri, new vscode.Position(7, 15), [
      [equatableDocUri, [new vscode.Range(6, 19, 6, 20), new vscode.Range(7, 15, 7, 16)]],
    ])
  })

  test('Should rename match-extracted variable', async () => {
    await testRename(equatableDocUri, new vscode.Position(9, 23), [
      [equatableDocUri, [new vscode.Range(9, 23, 9, 25), new vscode.Range(9, 58, 9, 60)]],
    ])
  })
  test('Should rename match-extracted variable-use', async () => {
    await testRename(equatableDocUri, new vscode.Position(9, 58), [
      [equatableDocUri, [new vscode.Range(9, 23, 9, 25), new vscode.Range(9, 58, 9, 60)]],
    ])
  })

  test('Should rename let-bound variable', async () => {
    await testRename(equatableDocUri, new vscode.Position(20, 8), [
      [equatableDocUri, [new vscode.Range(20, 8, 20, 13), new vscode.Range(22, 21, 22, 26)]],
    ])
  })
  test('Should rename let-bound variable-use', async () => {
    await testRename(equatableDocUri, new vscode.Position(22, 21), [
      [equatableDocUri, [new vscode.Range(20, 8, 20, 13), new vscode.Range(22, 21, 22, 26)]],
    ])
  })

  // Skipped since record labels is currently unsupported
  test.skip('Should rename record label', async () => {
    await testRename(recordsDocUri, new vscode.Position(3, 6), [
      [
        recordsDocUri,
        [
          new vscode.Range(2, 13, 2, 14),
          new vscode.Range(2, 48, 2, 49),
          new vscode.Range(3, 6, 3, 7),
          new vscode.Range(13, 14, 13, 15),
          new vscode.Range(15, 8, 15, 9),
          new vscode.Range(15, 15, 15, 16),
        ],
      ],
    ])
  })
})
