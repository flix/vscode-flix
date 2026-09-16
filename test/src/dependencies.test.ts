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
import { findMarkerPosition, getFileUri, getFixtureDocUri, init, teardown } from './util'

/**
 * Checks that a dependency declared in `flix.toml` is part of the program.
 *
 * `Main.flix` calls into `Extras.Queue`, which nothing in the workspace defines: it is only
 * available if the compiler has resolved the `github:flix/extras` dependency declared in the
 * manifest this suite writes into the active workspace. Hovering the calls is what proves the
 * symbols actually made it into the program — a resolution error would leave nothing to hover.
 */
suite('Dependencies', () => {
  // `Main.flix` is compiled where it lies, as in every other suite.
  const docUri = getFixtureDocUri('dependencies', 'Main.flix')

  // The manifest is a real file of the active workspace, since that is the project root the
  // compiler resolves dependencies for. No other suite puts anything there.
  const tomlUri = getWorkspaceDocUri('flix.toml')

  suiteSetup(async () => {
    // Written before `init`, so the manifest is already in place when the compiler starts.
    await vscode.workspace.fs.writeFile(tomlUri, await fixtureContent('flix.toml'))
    await init('dependencies')
  })

  suiteTeardown(async () => {
    await teardown('dependencies')
    // The manifest is not covered by the cleanup `init` does, so it has to be removed here —
    // otherwise it is left behind for the next run.
    await tryDeleteFile(tomlUri)
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
   * Get the URI of the file at `p` in the active workspace, e.g. `flix.toml`.
   *
   * Unlike {@linkcode getFixtureDocUri}, this points at a file which only exists while this suite is
   * running.
   */
  function getWorkspaceDocUri(p: string) {
    return getFileUri(path.resolve(__dirname, '../activeWorkspace', p))
  }

  /**
   * Returns the content of the file at `p` in the `workspace` directory of the test workspace, which
   * holds the files this suite copies into the active workspace.
   */
  async function fixtureContent(p: string): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(getFixtureDocUri('dependencies', `workspace/${p}`))
  }

  /**
   * Tries to delete the file at `uri`, but does nothing if the file does not exist.
   */
  async function tryDeleteFile(uri: vscode.Uri) {
    try {
      await vscode.workspace.fs.delete(uri)
    } catch {
      // The file was not there to begin with, which is what we wanted anyway.
    }
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
