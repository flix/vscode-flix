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
import { getTestDocUri, init, copyFile, deleteFile } from './util'

suite('Diagnostics', () => {
  /** The optional URI of the document which should be deleted after each test. */
  let tempDocUri: vscode.Uri | null = null

  suiteSetup(async () => {
    await init('diagnostics')
  })
  teardown(async () => {
    if (tempDocUri !== null) {
      await deleteFile(tempDocUri)
    }
  })

  /**
   * Assert that copying the file `fileName` from the `latent` directory to the `src` directory results in a diagnostic message containing the `expected` string.
   */
  async function testDiagnostics(fileName: string, expected: string) {
    const latentUri = getTestDocUri(`latent/${fileName}`)
    const srcUri = getTestDocUri(`src/${fileName}`)

    // Delete the file after the test
    tempDocUri = srcUri
    await copyFile(latentUri, srcUri)

    const diagnostics = vscode.languages.getDiagnostics(srcUri)
    assert.strictEqual(
      diagnostics.some(d => d.message.includes(expected)),
      true,
      `Actual: ${JSON.stringify(diagnostics)}\nExpected: ${expected}`,
    )
  }

  test('Should show weeder error', async () => {
    await testDiagnostics('WeederError.flix', "Multiple declarations of the formal parameter 'a'.")
  })

  test('Should show name error', async () => {
    await testDiagnostics('NameError.flix', "Duplicate definition of 'sum'.")
  })

  test('Should show resolution error', async () => {
    await testDiagnostics('ResolutionError.flix', 'Cyclic type aliases:')
  })

  test('Should show type error', async () => {
    await testDiagnostics('TypeError.flix', "Expected type 'String' but found type: 'Float64'.")
  })

  test('Should show redundancy error', async () => {
    await testDiagnostics('RedundancyError.flix', 'Shadowed name.')
  })

  test('Should show safety error', async () => {
    await testDiagnostics('SafetyError.flix', 'Missing default case.')
  })
})
