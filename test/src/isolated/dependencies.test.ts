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
import * as path from 'path'
import * as vscode from 'vscode'
import { findMarkerPosition, getFileUri, initWorkspace, sleep } from '../util'

/**
 * How long to wait after the compiler has gone idle before hovering.
 *
 * Resolving the dependency means downloading it, which is not covered by the idle signal the rest
 * of the suites synchronise on: the compiler can report itself idle while the package is still on
 * its way. Waiting is blunt, but there is nothing finer to wait for yet.
 */
const DEPENDENCY_RESOLUTION_MS = 30000

/**
 * Checks that a dependency declared in `flix.toml` is part of the program.
 *
 * This suite runs in `test/dependencyWorkspace`, a workspace folder of its own, launched as a
 * separate VS Code instance by `.vscode-test.js`. It therefore gets a Flix compiler no other suite
 * has touched, started against a project which already has its manifest on disk — the manifest
 * cannot arrive late, as it would in the workspace the other suites share.
 *
 * `src/Main.flix` calls into `Extras.Queue`, which nothing in the workspace defines: it is only
 * available if the compiler has resolved the `github:flix/extras` dependency declared in the
 * manifest. Hovering the calls is what proves the symbols made it into the program — a resolution
 * error would leave nothing to hover.
 */
suite('Dependencies', () => {
  const docUri = getWorkspaceDocUri('src/Main.flix')

  suiteSetup(async function () {
    // The wait below is on top of whatever starting the compiler costs, so give the hook room for
    // both rather than letting it run into the default timeout.
    this.timeout(DEPENDENCY_RESOLUTION_MS * 2 + 120000)

    await initWorkspace()
    await sleep(DEPENDENCY_RESOLUTION_MS)
  })

  test('Should show def when hovering on enqueue()-call', async () => {
    const position = await findMarkerPosition(docUri, 'enqueue')
    await testHoverAtPosition(position, ['def', 'enqueue', 'Queue'])
  })

  test('Should show doc when hovering on enqueue()-call', async () => {
    const position = await findMarkerPosition(docUri, 'enqueue')
    await testHoverAtPosition(position, ['element', 'back'])
  })

  test('Should show def when hovering on size()-call', async () => {
    const position = await findMarkerPosition(docUri, 'size')
    await testHoverAtPosition(position, ['def', 'size', 'Int32'])
  })

  /**
   * Get the URI of the file at `p` in this suite's workspace folder, e.g. `src/Main.flix`.
   */
  function getWorkspaceDocUri(p: string) {
    return getFileUri(path.resolve(__dirname, '../../dependencyWorkspace', p))
  }

  /**
   * Returns the given string, `s`, with all newlines replaced by a space.
   */
  function stripNewlines(s: string) {
    return s.replaceAll(/(\r\n|\n|\r)/g, ' ')
  }

  /**
   * Asserts that hovering at the given `position` in the document shows exactly one message, which contains all of the `expectedKeywords` (case-insensitive).
   */
  async function testHoverAtPosition(position: vscode.Position, expectedKeywords: string[]) {
    const r = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', docUri, position)

    assert.strictEqual(r.length, 1)

    const contents = r[0].contents[0] as vscode.MarkdownString
    const actualLower = stripNewlines(contents.value).toLowerCase()
    assert.strictEqual(
      expectedKeywords.every(kw => actualLower.includes(kw.toLowerCase())),
      true,
      `Actual: ${contents.value}\nExpected keywords: ${expectedKeywords.join(', ')}`,
    )
  }
})
