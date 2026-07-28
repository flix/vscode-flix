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
import { getFixtureDocUri, init, teardown, typeText } from './util'

suite('CompletionProvider', () => {
  const docUri = getFixtureDocUri('completions', 'Empty.flix')

  suiteSetup(async () => {
    await init('completions')
  })

  suiteTeardown(async () => {
    // Discard the typed text without saving it, so that the fixture is left empty on disk, and no
    // dirty editor is left for the next suite to trip over when it closes all editors.
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor')
    await teardown('completions')
  })

  test('Should propose completing mod', async () => {
    // Typing goes to the active editor, so the document has to be shown
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(docUri))
    await typeText('mo')

    const position = new vscode.Position(0, 2)
    const r = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      docUri,
      position,
    )

    assert.strictEqual(
      r.items.some(i => i.label === 'mod'),
      true,
    )
  })
})
