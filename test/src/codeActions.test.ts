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
import { getTestDocUri, init, open, stringify } from './util'

suite('Code actions', () => {
  const mainDocUri = getTestDocUri('src/Main.flix')
  const areaDocUri = getTestDocUri('src/Area.flix')
  const dividableDocUri = getTestDocUri('src/Dividable.flix')

  suiteSetup(async () => {
    await init('codeActions')
  })

  async function testCodeAction(docUri: vscode.Uri, position: vscode.Position, expectedTitle: string) {
    await open(docUri)

    const r = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      docUri,
      new vscode.Range(position, position),
    )

    const action = r.find(a => a.title.includes(expectedTitle))
    assert.notStrictEqual(
      action,
      undefined,
      `Code action '${expectedTitle}' not found in. Instead found: ${stringify(r)}`,
    )
  }

  suite('Prefix unused with underscore', () => {
    test('Should propose prefixing unused local variable with underscore', async () => {
      await testCodeAction(mainDocUri, new vscode.Position(4, 8), 'Prefix unused variable with underscore')
    })
    test('Should propose prefixing unused match-case variable with underscore', async () => {
      await testCodeAction(mainDocUri, new vscode.Position(8, 18), 'Prefix unused variable with underscore')
    })

    test('Should propose prefixing unused def with underscore', async () => {
      await testCodeAction(areaDocUri, new vscode.Position(9, 8), 'Prefix unused function with underscore')
    })

    test('Should propose prefixing unused formal parameter with underscore', async () => {
      await testCodeAction(areaDocUri, new vscode.Position(9, 13), 'Prefix unused parameter with underscore')
    })

    test('Should propose prefixing unused type parameter with underscore', async () => {
      await testCodeAction(areaDocUri, new vscode.Position(3, 15), 'Prefix unused type parameter with underscore')
    })

    test('Should propose prefixing unused effect with underscore', async () => {
      await testCodeAction(dividableDocUri, new vscode.Position(8, 8), 'Prefix unused effect with underscore')
    })

    // See https://github.com/flix/flix/issues/7896
    test.skip('Should propose prefixing unused enum with underscore', async () => {
      await testCodeAction(areaDocUri, new vscode.Position(3, 9), 'Prefix unused enum with underscore')
    })

    test('Should propose prefixing unused case with underscore', async () => {
      await testCodeAction(areaDocUri, new vscode.Position(5, 13), 'Prefix unused case with underscore')
    })
  })
})
