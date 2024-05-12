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
import { activate, getTestDocUri, sleep } from './util'

suite('Server disconnect', () => {
  suiteSetup(async () => {
    await activate('disconnect')
  })

  test('When server is disconnected a reconnection should happen automatically', async () => {
    await vscode.commands.executeCommand('flix.simulateDisconnect')

    // Wait for the server to disconnect, otherwise the next command will hang
    await sleep(1000)

    // Ensure that the server is reconnected
    const docUri = getTestDocUri('src/Main.flix')
    const position = new vscode.Position(9, 12)
    const r = (await vscode.commands.executeCommand('vscode.executeHoverProvider', docUri, position)) as vscode.Hover[]
    const contents = r[0].contents[0] as vscode.MarkdownString
    assert.strictEqual(contents.value.includes('Type'), true)
  })
})
