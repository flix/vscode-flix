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

  test('Should show WeederError', async () => {
    await testDiagnostics('WeederError.flix', ['duplicate', 'parameter'])
  })

  test('Should show NameError', async () => {
    await testDiagnostics('NameError.flix', ['duplicate', 'definition'])
  })

  test('Should show ResolutionError', async () => {
    await testDiagnostics('ResolutionError.flix', ['cyclic', 'type'])
  })

  test('Should show TypeError', async () => {
    await testDiagnostics('TypeError.flix', ['expected', 'type', 'found'])
  })

  test('Should show RedundancyError', async () => {
    await testDiagnostics('RedundancyError.flix', ['shadowed'])
  })

  test('Should show SafetyError', async () => {
    await testDiagnostics('SafetyError.flix', ['missing', 'default'])
  })

  /**
   * Assert that copying the file `fileName` from the `latent` directory to the `src` directory results in a diagnostic message containing all of the `expectedKeywords` (case-insensitive).
   */
  async function testDiagnostics(fileName: string, expectedKeywords: string[]) {
    const latentUri = getTestDocUri(`latent/${fileName}`)
    const srcUri = getTestDocUri(`src/${fileName}`)

    // Delete the file after the test
    tempDocUri = srcUri
    await copyFile(latentUri, srcUri)

    const diagnostics = vscode.languages.getDiagnostics(srcUri)
    assert.strictEqual(
      diagnostics.some(d => {
        const msgLower = d.message.toLowerCase()
        return expectedKeywords.every(kw => msgLower.includes(kw.toLowerCase()))
      }),
      true,
      `Actual: ${JSON.stringify(diagnostics)}\nExpected keywords: ${expectedKeywords.join(', ')}`,
    )
  }
})
