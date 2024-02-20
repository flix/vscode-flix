const assert = require('assert')

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const vscode = require('vscode')
// import * as myExtension from '../extension';

suite('Extension Test Suite', () => {
  suiteTeardown(() => {
    vscode.window.showInformationMessage('All tests done!')
  })

  test('Sample test', () => {
    assert.strictEqual(1, 1)
    assert.strictEqual(-1, [1, 2, 3].indexOf(0))
  })
})
