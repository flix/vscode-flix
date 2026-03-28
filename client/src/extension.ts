import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import * as jobs from './protocol/requests'

import createLanguageClient from './lsp/clientFactory'

import eventEmitter from './util/eventBus'
import initialiseState from './compiler/installedVersion'
import { FlixLspTerminal } from './ui/compilerTerminal'

import { callResolversAndEmptyList } from './util/timers'
import { registerFlixReleaseDocumentProvider } from './ui/releaseNotes'
import { USER_MESSAGE } from './ui/messages'

import { setupProjectWatchers, setupSingleFileTracking, disposeWatchers } from './lsp/fileWatchers'
import { startSession } from './lsp/session'
import { getUserConfiguration } from './lsp/notifications'

import { simulateDisconnect, showAst, allJobsFinished } from './commands/lspCommands'
import {
  runMain,
  cmdInit,
  cmdCheck,
  cmdBuild,
  cmdBuildJar,
  cmdBuildFatjar,
  cmdBuildPkg,
  cmdRunProject,
  cmdTests,
  cmdDoc,
  cmdOutdated,
} from './commands/replCommands'
import { initSharedRepl, startRepl } from './repl/manager'
import { LaunchOptions, defaultLaunchOptions } from './util/launchOptions'
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

function makeHandleRestartClient(context: vscode.ExtensionContext, launchOptions?: LaunchOptions) {
  return async function handleRestartClient() {
    callResolversAndEmptyList()
    await startSession(context, launchOptions, client, outputChannel, flixLspTerminal, () => {
      initSharedRepl(context, launchOptions)
    })
  }
}

export async function activate(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
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

  // Register commands for command palette
  registerCommand('flix.internalRestart', makeHandleRestartClient(context, { shouldUpdateFlix: false }))
  registerCommand('flix.internalDownloadLatest', makeHandleRestartClient(context, { shouldUpdateFlix: true }))
  registerCommand('flix.simulateDisconnect', simulateDisconnect(client))
  registerCommand('flix.runMain', runMain(context, launchOptions))

  registerCommand('flix.cmdInit', cmdInit(context, launchOptions))
  registerCommand('flix.cmdCheck', cmdCheck(context, launchOptions))
  registerCommand('flix.cmdBuild', cmdBuild(context, launchOptions))
  registerCommand('flix.cmdBuildJar', cmdBuildJar(context, launchOptions))
  registerCommand('flix.cmdBuildFatjar', cmdBuildFatjar(context, launchOptions))
  registerCommand('flix.cmdBuildPkg', cmdBuildPkg(context, launchOptions))
  registerCommand('flix.cmdRunProject', cmdRunProject(context, launchOptions))
  registerCommand('flix.cmdTests', cmdTests(context, launchOptions))
  registerCommand('flix.cmdDoc', cmdDoc(context, launchOptions))
  registerCommand('flix.cmdOutdated', cmdOutdated(context, launchOptions))
  registerCommand('flix.showAst', showAst(client))
  registerCommand('flix.startRepl', startRepl(context, launchOptions))

  // Register commands for testing

  // Returns a promise resolving when all jobs are completely finished and the server is idle.
  // While most other commands can be awaited directly, this is useful for stuff like file creation, which indirectely triggers an asynchronous job.
  registerCommand('flix.allJobsFinished', allJobsFinished(client, eventEmitter))

  if (isProjectMode()) {
    // In project mode, watch the file system for .flix/.fpkg/.jar/flix.toml changes.
    setupProjectWatchers(client, makeHandleRestartClient(context, launchOptions))
  } else {
    // In single-file mode there is no workspace folder to watch.
    setupSingleFileTracking(client)
  }

  vscode.window.onDidChangeActiveTextEditor(handleChangeEditor)
  vscode.workspace.onDidChangeConfiguration(() => {
    client.sendNotification(jobs.Request.internalReplaceConfiguration, getUserConfiguration())
  })

  await startSession(context, launchOptions, client, outputChannel, flixLspTerminal, () => {
    // start the Flix runner (but only after the Flix LSP instance has started.)
    initSharedRepl(context, launchOptions)
  })
}

export function deactivate(): Thenable<void> | undefined {
  disposeWatchers()
  outputChannel && outputChannel.dispose()
  return client ? client.stop() : undefined
}
