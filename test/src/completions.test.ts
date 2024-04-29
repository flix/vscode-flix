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
import { getTestDocUri, activate, open, tryDeleteFile, addFile, typeText } from './util'

suite('Completions', () => {
  const docUri = getTestDocUri('src/Temp.flix')

  suiteSetup(async () => {
    await activate()
  })
  teardown(async () => {
    await tryDeleteFile(docUri)
  })

  test('Should propose completing mod', async () => {
    await addFile(docUri, '')
    await open(docUri)
    await typeText('mo')

    // TODO: Figure out why this returns all possible keywords, which is not what is shown in the editor
    const position = new vscode.Position(0, 2)
    const r = (await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      docUri,
      position,
    )) as vscode.CompletionList

    assert.strictEqual(
      r.items.some(i => i.label === 'mod'),
      true,
    )
  })
})
