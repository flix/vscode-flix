import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import * as jobs from './engine/jobs'

import ensureTargetWritable from './util/ensureTargetWritable'
import ensureFlixExists from './util/ensureFlixExists'
import createLanguageClient from './util/createLanguageClient'
import showStartupProgress from './util/showStartupProgress'

import eventEmitter from './services/eventEmitter'
import initialiseState from './services/state'

import * as handlers from './handlers'
import { callResolversAndEmptyList } from './services/timers'

const _ = require('lodash/fp')

export interface LaunchOptions {
  shouldUpdateFlix: boolean
}

export const defaultLaunchOptions: LaunchOptions = {
  shouldUpdateFlix: false
}

let client: LanguageClient

let flixWatcher: vscode.FileSystemWatcher

const extensionObject = vscode.extensions.getExtension('flix.flix')

export const FLIX_GLOB_PATTERN = '**/*.flix'

let outputChannel: vscode.OutputChannel

let diagnosticsOutputChannel: vscode.OutputChannel

// flag to keep track of whether errors were present last time we ran diagnostics
let diagnosticsErrors = false

/**
 * Convert URI to file scheme URI shared by e.g. TextDocument's URI.
 *
 * @param uri {vscode.Uri}
 */
function vsCodeUriToUriString (uri: vscode.Uri) {
  return vscode.Uri.file(uri.path).toString(false)
}

function makeHandleRestartClient (context: vscode.ExtensionContext, launchOptions?: LaunchOptions) {
  return async function handleRestartClient () {
    callResolversAndEmptyList()
    await startSession(context, launchOptions, client)
  }
}

function getUserConfiguration () {
  return vscode.workspace.getConfiguration('flix')
}

function handlePrintDiagnostics ({ status, result }) {
  if (status === 'success') {
    if (diagnosticsErrors) {
      diagnosticsOutputChannel.clear()
      diagnosticsErrors = false
    }
  } else {
    diagnosticsOutputChannel.clear()
    diagnosticsErrors = true
    for (const res of result) {
      for (const diag of res.diagnostics) {
        diagnosticsOutputChannel.appendLine(`${String.fromCodePoint(0x274C)} ${diag.fullMessage}`)
      }
    }
    diagnosticsOutputChannel.show(true)
  }
}

export async function activate (context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  // activate state
  initialiseState(context)

  // create output channels
  outputChannel = vscode.window.createOutputChannel('Flix')
  diagnosticsOutputChannel = vscode.window.createOutputChannel('Flix Compiler')

  // create language client
  client = createLanguageClient({ context, outputChannel })

  // Start the client. This will also launch the server
  client.start()

  // Wait for client and server to be ready before registering listeners
  await client.onReady()

  // Utility for safely registering commands
  const registeredCommands = await vscode.commands.getCommands(true)
  const registerCommand = (command: string, callback: any) => {
    if (!_.includes(command, registeredCommands)) {
      vscode.commands.registerCommand(command, callback)
    }
  }

  // Register commands for command palette
  registerCommand('flix.internalRestart', makeHandleRestartClient(context, { shouldUpdateFlix: false }))
  registerCommand('flix.internalDownloadLatest', makeHandleRestartClient(context, { shouldUpdateFlix: true }))
  registerCommand('flix.runMain', handlers.runMain(context, launchOptions))
  registerCommand('flix.runMainWithArgs', handlers.runMainWithArgs(context, launchOptions))
  registerCommand('flix.runMainNewTerminal', handlers.runMainNewTerminal(context, launchOptions))
  registerCommand('flix.runMainNewTerminalWithArgs', handlers.runMainNewTerminalWithArgs(context, launchOptions))
  
  registerCommand('flix.cmdInit', handlers.cmdInit(context, launchOptions))
  registerCommand('flix.cmdCheck', handlers.cmdCheck(context, launchOptions))
  registerCommand('flix.cmdBuild', handlers.cmdBuild(context, launchOptions))
  registerCommand('flix.cmdBuildJar', handlers.cmdBuildJar(context, launchOptions))
  registerCommand('flix.cmdBuildPkg', handlers.cmdBuildPkg(context, launchOptions))
  registerCommand('flix.cmdRunProject', handlers.cmdRunProject(context, launchOptions))
  registerCommand('flix.cmdBenchmark', handlers.cmdBenchmark(context, launchOptions))
  registerCommand('flix.cmdTests', handlers.cmdTests(context, launchOptions))
  registerCommand('flix.cmdTestWithFilter', handlers.cmdTestWithFilter(context, launchOptions))
  
  // watch for changes on the file system (delete, create, rename .flix files)
  flixWatcher = vscode.workspace.createFileSystemWatcher(FLIX_GLOB_PATTERN)
  flixWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    client.sendNotification(jobs.Request.apiRemUri, { uri })
  })
  flixWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    client.sendNotification(jobs.Request.apiAddUri, { uri })
  })

  vscode.workspace.onDidChangeConfiguration(() => {
    client.sendNotification(jobs.Request.internalReplaceConfiguration, getUserConfiguration())
  })

  await startSession(context, launchOptions, client)
}

async function startSession (context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions, client: LanguageClient) {
  // clear listeners from previous sessions
  eventEmitter.removeAllListeners()

  // clear outputs
  outputChannel.clear()
  diagnosticsOutputChannel.clear()
  
  // show default output channel without changing focus
  outputChannel.show(true)

  const globalStoragePath = context.globalStoragePath
  const workspaceFolders = _.map(_.flow(_.get('uri'), _.get('fsPath')), vscode.workspace.workspaceFolders)
  const workspaceFiles: [string] = _.map(vsCodeUriToUriString, (await vscode.workspace.findFiles(FLIX_GLOB_PATTERN)))

  // Make sure we can write to `./target`
  if (!ensureTargetWritable(_.first(workspaceFolders))) {
    throw new Error('Cannot write to "target" folder.')
  }

  // Wait until we're sure flix exists
  const flixFilename = await ensureFlixExists({ globalStoragePath, workspaceFolders, shouldUpdateFlix: launchOptions.shouldUpdateFlix })

  // Show a startup progress that times out after 10 (default) seconds
  showStartupProgress()

  // Send start notification to the server which actually starts the Flix compiler
  client.sendNotification(jobs.Request.internalReady, {
    flixFilename,
    workspaceFolders,
    extensionPath: extensionObject.extensionPath || context.extensionPath,
    extensionVersion: extensionObject.packageJSON.version,
    globalStoragePath: context.globalStoragePath,
    workspaceFiles,
    userConfiguration: getUserConfiguration()
  })

  // Handle when server has answered back after getting the notification above
  client.onNotification(jobs.Request.internalReady, function handler () {
    // waits for server to answer back after having started successfully
    eventEmitter.emit(jobs.Request.internalReady)
  })

  client.onNotification(jobs.Request.internalFinishedJob, function handler () {
    // only one job runs at once, so currently not trying to distinguish
    eventEmitter.emit(jobs.Request.internalFinishedJob)
  })

  client.onNotification(jobs.Request.internalDiagnostics, handlePrintDiagnostics)

  client.onNotification(jobs.Request.internalRestart, makeHandleRestartClient(context))

  client.onNotification(jobs.Request.internalMessage, vscode.window.showInformationMessage)

  client.onNotification(jobs.Request.internalError, vscode.window.showErrorMessage)
}

export function deactivate (): Thenable<void> | undefined {
  flixWatcher && flixWatcher.dispose()
  outputChannel && outputChannel.dispose()
  diagnosticsOutputChannel && diagnosticsOutputChannel.dispose()
  return client ? client.stop() : undefined
}
