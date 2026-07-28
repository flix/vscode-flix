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
import * as path from 'path'
import * as vscode from 'vscode'
import { awaitCheck, getFileUri, getFixtureDocUri, init, teardown } from './util'

suite('File manipulation', () => {
  // `Main.flix` and `Assert.flix` are compiled where they lie, as in every other suite.
  const mainDocUri = getFixtureDocUri('files', 'Main.flix')

  // These two are real files of the active workspace: this suite is about the extension noticing
  // that they appear and disappear, which only a file-system watcher can report.
  const areaDocUri = getWorkspaceDocUri('src/Area.flix')
  const fpkgUri = getWorkspaceDocUri('lib/circleArea.fpkg')

  suiteSetup(async () => {
    await init('files')
  })

  suiteTeardown(async () => {
    await tryDeleteFile(areaDocUri)
    await tryDeleteFile(fpkgUri)
    await teardown('files')
  })

  setup(async () => {
    // Create the files from scratch before each test, so that the compiler is given them by the file
    // watcher no matter what the previous test did to them.
    await recreateFile(areaDocUri, 'src/Area.flix')
    await recreateFile(fpkgUri, 'lib/circleArea.fpkg')
  })

  test('Should add created source-file', async () => {
    await deleteFile(areaDocUri)
    await addFile(areaDocUri, await fixtureContent('src/Area.flix'))
    assert.strictEqual(await workspaceValid(), true)
  })

  test('Should remove deleted source-file', async () => {
    await deleteFile(areaDocUri)
    assert.strictEqual(await workspaceValid(), false)
  })

  test('Should add created fpkg-file', async () => {
    await deleteFile(fpkgUri)
    await addFile(fpkgUri, await fixtureContent('lib/circleArea.fpkg'))
    assert.strictEqual(await workspaceValid(), true)
  })

  test('Should remove deleted fpkg-file', async () => {
    await deleteFile(fpkgUri)
    assert.strictEqual(await workspaceValid(), false)
  })

  async function workspaceValid() {
    // If all files are not present in the compiler, then Main.flix will contain a resolution error
    const r = [...vscode.languages.getDiagnostics(mainDocUri), ...vscode.languages.getDiagnostics(areaDocUri)]
    return r.length === 0
  }

  /**
   * Get the URI of the file at `p` in the active workspace, e.g. `src/Area.flix`.
   *
   * Unlike {@linkcode getFixtureDocUri}, this points at a file which only exists while this suite is
   * running: no other suite puts anything in the active workspace.
   */
  function getWorkspaceDocUri(p: string) {
    return getFileUri(path.resolve(__dirname, '../activeWorkspace', p))
  }

  /**
   * Returns the content of the file at `p` in the `workspace` directory of the test workspace, which
   * holds the files this suite copies into the active workspace.
   */
  async function fixtureContent(p: string): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(getFixtureDocUri('files', `workspace/${p}`))
  }

  /**
   * Deletes the file at `uri` if it exists, and creates it again with the content of `p`.
   */
  async function recreateFile(uri: vscode.Uri, p: string) {
    await tryDeleteFile(uri)
    await addFile(uri, await fixtureContent(p))
  }

  /**
   * Add a file with the given `uri` and `content`, and wait for the compiler to process this.
   */
  async function addFile(uri: vscode.Uri, content: Uint8Array) {
    await awaitCheck(async () => {
      await vscode.workspace.fs.writeFile(uri, content)
    })
  }

  /**
   * Delete the file at `uri`, and wait for the compiler to process this.
   *
   * Throws if the file does not exist.
   */
  async function deleteFile(uri: vscode.Uri) {
    await awaitCheck(async () => {
      await vscode.workspace.fs.delete(uri)
    })
  }

  /**
   * Tries to delete the file at `uri`, but does nothing if the file does not exist.
   */
  async function tryDeleteFile(uri: vscode.Uri) {
    try {
      await deleteFile(uri)
    } catch {
      // File does not exist - no need to delete
    }
  }
})
