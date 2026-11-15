import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import * as jobs from './protocol/requests'

import createLanguageClient from './lsp/clientFactory'

import eventEmitter from './util/eventBus'
import initialiseState from './compiler/globalState'
import { downloadLatestFlix } from './compiler/download'
import { FlixLspTerminal } from './ui/compilerTerminal'

import { registerFlixReleaseDocumentProvider } from './ui/releaseNotes'
import { USER_MESSAGE } from './ui/messages'

import { setupProjectWatchers, setupSingleFileTracking, disposeWatchers } from './lsp/fileWatchers'
import { startSession } from './lsp/session'
import { getUserConfiguration, getCheckCount } from './lsp/notifications'

import { showAst, allJobsFinished, addUri } from './commands/lspCommands'
import { runMain, cmdTests } from './commands/replCommands'
import { initSharedRepl, startRepl, disposeAllRepls, restartRepl } from './repl/manager'
import { isProjectMode, getFlixGlobPattern } from './util/workspace'

let client: LanguageClient

let outputChannel: vscode.OutputChannel

let flixLspTerminal: FlixLspTerminal

/**
 * Handle the user changing the active editor, to view a different file.
 *
 * If the new file is not part of the project, it shows a message to the user.
 */
function handleChangeEditor(editor: vscode.TextEditor | undefined) {
  if (editor === undefined) {
    return
  }

  const isFlixFile = editor.document.uri.path.endsWith('.flix')
  if (!isFlixFile) {
    return
  }

  // In single-file mode every .flix file is valid — there is no project boundary.
  if (!isProjectMode()) {
    return
  }

  const included = vscode.languages.match({ pattern: getFlixGlobPattern() }, editor.document)
  if (!included) {
    vscode.window.showWarningMessage(USER_MESSAGE.FILE_NOT_PART_OF_PROJECT())
  }
}

export async function activate(context: vscode.ExtensionContext) {
  if (!isProjectMode()) {
    vscode.window.showWarningMessage(USER_MESSAGE.SINGLE_FILE_MODE())
  }

  // activate state
  initialiseState(context)

  registerFlixReleaseDocumentProvider(context)

  // create output channels
  outputChannel = vscode.window.createOutputChannel('Flix (Internal)')

  // create and show Flix LSP Server terminal
  flixLspTerminal = new FlixLspTerminal()
  const terminal = vscode.window.createTerminal({ name: 'Flix Compiler', pty: flixLspTerminal })
  terminal.show()

  // create language client
  client = createLanguageClient({ context, outputChannel })

  // Start the client. This will also launch the server
  await client.start()

  // Utility for safely registering commands
  const registeredCommands = await vscode.commands.getCommands(true)
  const registerCommand = (command: string, callback: (...args: any[]) => any) => {
    if (!registeredCommands.includes(command)) {
      vscode.commands.registerCommand(command, callback)
    }
  }

  // Commands contributed in package.json, and so offered in the command palette.
  registerCommand('flix.cmdDownload', () => downloadLatestFlix(context.globalStorageUri.fsPath))
  registerCommand('flix.cmdShowAst', showAst(client))
  registerCommand('flix.cmdStartRepl', startRepl())

  // Commands invoked from the code lenses the compiler provides. Registering them is enough for the
  // lens to resolve them; they are not contributed, so they never appear in the command palette.
  //
  // These two ids are not ours to choose: the compiler hard-codes them in CodeLensProvider.scala
  // and VS Code resolves a lens by the string the server sends. Renaming one here breaks the lens
  // until the compiler agrees, so they do not follow the cmd/lens/internal naming of the others.
  registerCommand('flix.runMain', runMain())
  registerCommand('flix.cmdTests', cmdTests())

  // Commands used by the test suite, reached with executeCommand. Not contributed either, for the
  // same reason.

  // Returns a promise resolving when all jobs are completely finished and the server is idle.
  // While most other commands can be awaited directly, this is useful for stuff like file creation, which indirectely triggers an asynchronous job.
  registerCommand('flix.internalAllJobsFinish', allJobsFinished(client, eventEmitter))

  // Returns the number of lsp/check responses observed since startup. Tests baseline this before a
  // filesystem change and wait for it to advance, to deterministically detect the resulting check.
  registerCommand('flix.internalCheckCount', () => getCheckCount())

  // Add a file directly to the compiler, bypassing the file system. Tests use this to set up a
  // workspace without copying files into place.
  registerCommand('flix.addUri', addUri(client))

  if (isProjectMode()) {
    // In project mode, watch the file system for .flix/.fpkg/.jar/flix.toml changes.
    //
    // A manifest change reboots the REPL: the compiler is told to load the project again, which it
    // does in place, but the REPL resolved its dependencies when it was launched.
    setupProjectWatchers(client, restartRepl)
  } else {
    // In single-file mode there is no workspace folder to watch.
    setupSingleFileTracking(client)
  }

  vscode.window.onDidChangeActiveTextEditor(handleChangeEditor)
  vscode.workspace.onDidChangeConfiguration(() => {
    client.sendNotification(jobs.Request.internalReplaceConfiguration, getUserConfiguration())
  })

  // No REPL has been launched yet, so one which exists is a leftover of an earlier session. VS Code
  // can revive the terminal of a REPL when a window is restored, even though it is transient: it
  // launches the command line it was started with again, without asking us. Such a REPL is not
  // ours to use, and it runs the compiler of that session, which may be older than ours.
  disposeAllRepls()

  await startSession(context, client, flixLspTerminal, () => {
    // start the Flix runner (but only after the Flix LSP instance has started.)
    initSharedRepl()
  })
}

export function deactivate(): Thenable<void> | undefined {
  disposeWatchers()
  outputChannel && outputChannel.dispose()
  return client ? client.stop() : undefined
}
