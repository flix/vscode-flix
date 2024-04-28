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
import { getTestDocUri, activate, open, copyFile, tryDeleteFile } from './util'

suite('Code actions', () => {
  const docUriLatent = getTestDocUri('latent/UnusedFunction.flix')
  const docUri = getTestDocUri('src/UnusedFunction.flix')

  suiteSetup(async () => {
    await activate()
  })
  teardown(async () => {
    await tryDeleteFile(docUri)
  })

  test('Should propose prefixing unused def with underscore', async () => {
    await copyFile(docUriLatent, docUri)
    await open(docUri)

    const position = new vscode.Position(1, 8)
    const range = new vscode.Range(position, position)
    const r = (await vscode.commands.executeCommand(
      'vscode.executeCodeActionProvider',
      docUri,
      range,
    )) as vscode.CodeAction[]

    assert.strictEqual(r.length, 1)
    assert.strictEqual(r[0].title, 'Prefix unused function with underscore')
  })
})
