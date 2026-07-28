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
import { getFixtureDocUri, init, teardown } from './util'

suite('CodeLensProvider', () => {
  const mainDocUri = getFixtureDocUri('codeLenses', 'Main.flix')
  const areaDocUri = getFixtureDocUri('codeLenses', 'Area.flix')

  suiteSetup(async () => {
    await init('codeLenses')
  })

  suiteTeardown(async () => {
    await teardown('codeLenses')
  })

  test('Should propose running main function', async () => {
    const r = await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider', mainDocUri)
    assert.strictEqual(
      r.some(l => l.command?.command === 'flix.runMain'),
      true,
    )
  })

  test('Should propose running test function', async () => {
    const r = await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider', areaDocUri)
    assert.strictEqual(
      r.some(l => l.command?.command === 'flix.runMain'),
      true,
    )
    assert.strictEqual(
      r.some(l => l.command?.command === 'flix.cmdTests'),
      true,
    )
  })
})
