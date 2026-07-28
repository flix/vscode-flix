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
import { blankFile, getFixtureDocUri, init, loadFile, teardown } from './util'

suite('Diagnostics', () => {
  suiteSetup(async () => {
    await init('diagnostics')
  })

  suiteTeardown(async () => {
    await teardown('diagnostics')
  })

  test('Should show NameError', () => {
    testDiagnostics('NameError.flix', ['duplicate', 'definition'])
  })

  test('Should show ResolutionError', () => {
    testDiagnostics('ResolutionError.flix', ['undefined', 'name'])
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
    const docUri = getFixtureDocUri('diagnostics', 'NameError.flix')

    // Verify the error is present
    const before = vscode.languages.getDiagnostics(docUri)
    assert.strictEqual(before.length > 0, true, 'Expected diagnostics before clearing')

    // Clear the file content (simulates select all + delete)
    await blankFile(docUri)

    // Verify the error is gone
    const after = vscode.languages.getDiagnostics(docUri)

    // Restore the file, so that this test does not depend on being the last one
    await loadFile(docUri)

    assert.strictEqual(after.length, 0, `Expected no diagnostics after clearing, got: ${JSON.stringify(after)}`)
  })

  /**
   * Assert that the file `fileName` of the test workspace has a diagnostic message containing all of the `expectedKeywords` (case-insensitive).
   */
  function testDiagnostics(fileName: string, expectedKeywords: string[]) {
    assertDiagnostics(getFixtureDocUri('diagnostics', fileName), expectedKeywords)
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
