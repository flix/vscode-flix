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
  /** The optional URI of the document which should be deleted after each test. */
  let tempDocUri: vscode.Uri | null = null

  suiteSetup(async () => {
    await activate()
  })
  teardown(async () => {
    if (tempDocUri !== null) {
      await vscode.workspace.fs.delete(tempDocUri)
      await sleep(1000)
    }
  })

  /**
   * Assert that copying the file `fileName` from the `latent` directory to the `src` directory results in a diagnostic message containing the `expected` string.
   *
   * @param fileName The name of the file to copy, e.g. `WeederError.flix`
   */
  async function testDiagnostics(fileName: string, expected: string) {
    const latentUri = getTestDocUri(`latent/${fileName}`)
    const srcUri = getTestDocUri(`src/${fileName}`)

    await vscode.workspace.fs.copy(latentUri, srcUri)
    // Delete the file after the test
    tempDocUri = srcUri
    await sleep(4000)

    const diagnostics = vscode.languages.getDiagnostics(srcUri)
    assert.strictEqual(
      diagnostics.some(d => d.message.includes(expected)),
      true,
      `Actual: ${JSON.stringify(diagnostics)}\nExpected: ${expected}`,
    )
  }

  test('Weeder error should be shown', async () => {
    await testDiagnostics('WeederError.flix', "Multiple declarations of the formal parameter 'a'.")
  })

  test('Name error should be shown', async () => {
    await testDiagnostics('NameError.flix', "Duplicate definition of 'sum'.")
  })

  test('Resolution error should be shown', async () => {
    await testDiagnostics('ResolutionError.flix', "Cyclic type aliases: 'Even' references 'Odd' references 'Even'")
  })

  test('Type error should be shown', async () => {
    await testDiagnostics('TypeError.flix', "Expected type 'String' but found type: 'Float64'.")
  })
})
