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
import { blankFile, getFixtureDocUri, init2, loadFile, teardown2 } from './util'

suite('Diagnostics', () => {
  /** The optional URI of the latent file which should be blanked again after each test. */
  let loadedDocUri: vscode.Uri | null = null

  suiteSetup(async () => {
    await init2('diagnostics')
  })

  suiteTeardown(async () => {
    await teardown2('diagnostics')
  })

  teardown(async () => {
    if (loadedDocUri !== null) {
      await blankFile(loadedDocUri)
      loadedDocUri = null
    }
  })

  test('Should show WeederError', async () => {
    await testLatentDiagnostics('WeederError.flix', ['duplicate', 'parameter'])
  })

  test('Should show NameError', () => {
    testDiagnostics('NameError.flix', ['duplicate', 'definition'])
  })

  test('Should show ResolutionError', async () => {
    await testLatentDiagnostics('ResolutionError.flix', ['cyclic', 'type'])
  })

  test('Should show TypeError', () => {
    testDiagnostics('TypeError.flix', ['expected', 'type', 'found'])
  })

  test('Should show RedundancyError', () => {
    testDiagnostics('RedundancyError.flix', ['shadowed'])
  })

  test('Should show SafetyError', () => {
    testDiagnostics('SafetyError.flix', ['throw'])
  })

  test('Should clear diagnostics when file content is cleared', async () => {
    const docUri = await loadLatentFile('WeederError.flix')

    // Verify the error is present
    const before = vscode.languages.getDiagnostics(docUri)
    assert.strictEqual(before.length > 0, true, 'Expected diagnostics before clearing')

    // Clear the file content (simulates select all + delete)
    await blankFile(docUri)

    // Verify the error is gone
    const after = vscode.languages.getDiagnostics(docUri)
    assert.strictEqual(after.length, 0, `Expected no diagnostics after clearing, got: ${JSON.stringify(after)}`)
  })

  /**
   * Loads the file `fileName` of the `latent` directory into the compiler, so that it becomes part of
   * the program, and blanks it again after the test.
   *
   * @returns the URI of the loaded file
   */
  async function loadLatentFile(fileName: string): Promise<vscode.Uri> {
    const docUri = getFixtureDocUri('diagnostics', `latent/${fileName}`)
    loadedDocUri = docUri
    await loadFile(docUri)
    return docUri
  }

  /**
   * Assert that the file `fileName` of the test workspace has a diagnostic message containing all of the `expectedKeywords` (case-insensitive).
   *
   * The file is part of the program from the start, since `init2` loads it along with the rest.
   */
  function testDiagnostics(fileName: string, expectedKeywords: string[]) {
    assertDiagnostics(getFixtureDocUri('diagnostics', fileName), expectedKeywords)
  }

  /**
   * Assert the same as {@linkcode testDiagnostics}, but for a file of the `latent` directory, which
   * is part of the program for the duration of this test only.
   *
   * Its error suppresses the errors of the other files, so it cannot be part of the program the
   * other tests assert on.
   */
  async function testLatentDiagnostics(fileName: string, expectedKeywords: string[]) {
    const docUri = await loadLatentFile(fileName)
    assertDiagnostics(docUri, expectedKeywords)
  }

  function assertDiagnostics(docUri: vscode.Uri, expectedKeywords: string[]) {
    const diagnostics = vscode.languages.getDiagnostics(docUri)
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
