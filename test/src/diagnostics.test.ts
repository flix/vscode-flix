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
import { getTestDocUri, activate, sleep } from './util'

suite('Diagnostics', () => {
  suiteSetup(async () => {
    await activate()
  })

  /**
   * Copy a file from the `latent` directory to the `src` directory,
   * and add teardown hook to remove it again after the test.
   *
   * @param name the filename of the file to copy, e.g. `WeederError.flix`
   */
  async function activateLatent(name: string) {
    const latentUri = getTestDocUri(`latent/${name}`)
    const srcUri = getTestDocUri(`src/${name}`)

    await vscode.workspace.fs.copy(latentUri, srcUri)
    await sleep(4000)

    teardown(async () => {
      await vscode.workspace.fs.delete(srcUri)
      await sleep(1000)
    })
  }

  function assertContainsDiagnostic(docUri: vscode.Uri, message: string) {
    const diagnostics = vscode.languages.getDiagnostics(docUri)
    assert.strictEqual(
      diagnostics.some(d => d.message.includes(message)),
      true,
      `Actual: ${JSON.stringify(diagnostics)}\nExpected: ${message}`,
    )
  }

  test('Weeder error should be shown', async () => {
    const docUri = getTestDocUri('src/WeederError.flix')
    await activateLatent('WeederError.flix')
    assertContainsDiagnostic(docUri, "Multiple declarations of the formal parameter 'a'.")
  })
})
