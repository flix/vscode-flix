/*
 * Copyright 2026 Magnus Madsen
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

suite('FoldingRangeProvider', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')

  suiteSetup(async () => {
    await init('foldingRanges')
  })

  test('Should fold multi-line doc, line, and block comments', async () => {
    await open(mainDocUri)
    const ranges = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
      'vscode.executeFoldingRangeProvider',
      mainDocUri,
    )

    // Lines are zero-indexed. See `test/testWorkspaces/foldingRanges/src/Main.flix`.
    const actual = ranges.map(r => ({ start: r.start, end: r.end, kind: r.kind })).sort((a, b) => a.start - b.start)

    const expected = [
      { start: 0, end: 2, kind: vscode.FoldingRangeKind.Comment }, // the `///` doc comment
      { start: 4, end: 6, kind: vscode.FoldingRangeKind.Comment }, // the `//` line comment
      { start: 9, end: 12, kind: vscode.FoldingRangeKind.Comment }, // the `/* ... */` block comment
    ]

    assert.deepStrictEqual(actual, expected)
  })
})
