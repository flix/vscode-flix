import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import * as jobs from './engine/jobs'

import createLanguageClient from './util/createLanguageClient'

import eventEmitter from './services/eventEmitter'
import initialiseState from './services/state'
import { FlixLspTerminal } from './services/flixLspTerminal'

import * as handlers from './handlers'
import { callResolversAndEmptyList } from './services/timers'
import { registerFlixReleaseDocumentProvider } from './services/releaseVirtualDocument'
import { USER_MESSAGE } from './util/userMessages'

import { setupProjectWatchers, setupSingleFileTracking, disposeWatchers } from './lsp/fileWatchers'
import { startSession } from './lsp/session'
import { getUserConfiguration } from './lsp/notifications'

export interface LaunchOptions {
  shouldUpdateFlix: boolean
}

export const defaultLaunchOptions: LaunchOptions = {
  shouldUpdateFlix: false,
}

let client: LanguageClient

let outputChannel: vscode.OutputChannel

let flixLspTerminal: FlixLspTerminal

/**
 * Whether the extension is running in project mode (a workspace folder is open)
 * or single-file mode (a standalone `.flix` file with no folder).
 *
 * Returns a fresh value each call, so it reflects workspace changes (e.g. if
 * VS Code reloads after the user opens a folder).
 */
export function isProjectMode(): boolean {
  return (vscode.workspace.workspaceFolders?.length ?? 0) > 0
}

/**
 * Glob patterns scoped to the first workspace folder.
 *
 * These are functions (not module-level constants) so that evaluation is
 * deferred until call-time inside `activate()`. At module-load time
 * `workspaceFolders` may be undefined (single-file mode).
 *
 * All callers run after `activate()`, where a workspace folder is guaranteed
 * in project mode. In single-file mode these functions must not be called —
 * file discovery uses open-document events instead.
 */
export function getFlixGlobPattern() {
  return new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], '{*.flix,src/**/*.flix,test/**/*.flix}')
}
export function getFpkgGlobPattern() {
  return new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], 'lib/**/*.fpkg')
}
export function getJarGlobPattern() {
  return new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], 'lib/**/*.jar')
}
export function getFlixTomlGlobPattern() {
  return new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], 'flix.toml')
}

function makeHandleRestartClient(context: vscode.ExtensionContext, launchOptions?: LaunchOptions) {
  return async function handleRestartClient() {
    callResolversAndEmptyList()
    await startSession(context, launchOptions, client, outputChannel, flixLspTerminal, () => {
      handlers.initSharedRepl(context, launchOptions)
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
  registerCommand('flix.simulateDisconnect', handlers.simulateDisconnect(client))
  registerCommand('flix.runMain', handlers.runMain(context, launchOptions))

  registerCommand('flix.cmdInit', handlers.cmdInit(context, launchOptions))
  registerCommand('flix.cmdCheck', handlers.cmdCheck(context, launchOptions))
  registerCommand('flix.cmdBuild', handlers.cmdBuild(context, launchOptions))
  registerCommand('flix.cmdBuildJar', handlers.cmdBuildJar(context, launchOptions))
  registerCommand('flix.cmdBuildFatjar', handlers.cmdBuildFatjar(context, launchOptions))
  registerCommand('flix.cmdBuildPkg', handlers.cmdBuildPkg(context, launchOptions))
  registerCommand('flix.cmdRunProject', handlers.cmdRunProject(context, launchOptions))
  registerCommand('flix.cmdTests', handlers.cmdTests(context, launchOptions))
  registerCommand('flix.cmdDoc', handlers.cmdDoc(context, launchOptions))
  registerCommand('flix.cmdOutdated', handlers.cmdOutdated(context, launchOptions))
  registerCommand('flix.showAst', handlers.showAst(client))
  registerCommand('flix.startRepl', handlers.startRepl(context, launchOptions))

  // Register commands for testing

  // Returns a promise resolving when all jobs are completely finished and the server is idle.
  // While most other commands can be awaited directly, this is useful for stuff like file creation, which indirectely triggers an asynchronous job.
  registerCommand('flix.allJobsFinished', handlers.allJobsFinished(client, eventEmitter))

  if (isProjectMode()) {
    // In project mode, watch the file system for .flix/.fpkg/.jar/flix.toml changes.
    setupProjectWatchers(client, makeHandleRestartClient(context, launchOptions))
  } else {
    // In single-file mode there is no workspace folder to watch.
    setupSingleFileTracking(client)
  }

  vscode.window.onDidChangeActiveTextEditor(handlers.handleChangeEditor)
  vscode.workspace.onDidChangeConfiguration(() => {
    client.sendNotification(jobs.Request.internalReplaceConfiguration, getUserConfiguration())
  })

  await startSession(context, launchOptions, client, outputChannel, flixLspTerminal, () => {
    // start the Flix runner (but only after the Flix LSP instance has started.)
    handlers.initSharedRepl(context, launchOptions)
  })
}

export function deactivate(): Thenable<void> | undefined {
  disposeWatchers()
  outputChannel && outputChannel.dispose()
  return client ? client.stop() : undefined
}
