import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import * as jobs from './engine/jobs'

import ensureFlixExists from './util/ensureFlixExists'
import createLanguageClient from './util/createLanguageClient'
import showStartupProgress from './util/showStartupProgress'

import eventEmitter from './services/eventEmitter'
import initialiseState from './services/state'

import * as handlers from './handlers'
import { callResolversAndEmptyList } from './services/timers'
import { registerFlixReleaseDocumentProvider } from './services/releaseVirtualDocument'
import codeActions from './services/codeActions'


const _ = require('lodash/fp')

export interface LaunchOptions {
  shouldUpdateFlix: boolean
}

export const defaultLaunchOptions: LaunchOptions = {
  shouldUpdateFlix: false
}

let client: LanguageClient

let flixWatcher: vscode.FileSystemWatcher

let pkgWatcher: vscode.FileSystemWatcher

let tomlWatcher: vscode.FileSystemWatcher

const extensionObject = vscode.extensions.getExtension('flix.flix')

export const FLIX_GLOB_PATTERN = '**/*.flix'

export const FPKG_GLOB_PATTERN = new vscode.RelativePattern(vscode.workspace.workspaceFolders?.[0], 'lib/**/*.fpkg')
export const JAR_GLOB_PATTERN = new vscode.RelativePattern(vscode.workspace.workspaceFolders?.[0], 'lib/**/*.jar')
export const FLIX_TOML_GLOB_PATTERN = new vscode.RelativePattern(vscode.workspace.workspaceFolders?.[0], 'flix.toml')

let outputChannel: vscode.OutputChannel

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
      outputChannel.clear()
      diagnosticsErrors = false
    }
  } else {
    outputChannel.clear()
    diagnosticsErrors = true
    for (const res of result) {
      for (const diag of res.diagnostics) {
        if (diag.severity <= 2) {
            outputChannel.appendLine(`${String.fromCodePoint(0x274C)} ${diag.fullMessage}`)
        }
      }
    }
  }
}

let codeActionsFound = false

function handleCodeAction({status, result}) {
    // Constructor call changes depending on which properties we need for our code actions
    const codeAction = new codeActions(result.kind, result.edit.newText);

    // Registers the code actions the first time we get a response from the server
    if (!codeActionsFound) {
        vscode.languages.registerCodeActionsProvider('flix', codeAction);
        codeActionsFound = true
    }
}

export async function activate (context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  // activate state
  initialiseState(context)

  registerFlixReleaseDocumentProvider(context);

  // create output channels
  outputChannel = vscode.window.createOutputChannel('Flix Compiler')

  // create language client
  client = createLanguageClient({ context, outputChannel })

  // Start the client. This will also launch the server
  await client.start()

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
  //registerCommand('flix.runMainWithArgs', handlers.runMainWithArgs(context, launchOptions))
  //registerCommand('flix.runMainNewTerminal', handlers.runMainNewTerminal(context, launchOptions))
  //registerCommand('flix.runMainNewTerminalWithArgs', handlers.runMainNewTerminalWithArgs(context, launchOptions))
  
  //registerCommand('flix.cmdInit', handlers.cmdInit(context, launchOptions))
  registerCommand('flix.cmdCheck', handlers.cmdCheck(context, launchOptions))
  registerCommand('flix.cmdBuild', handlers.cmdBuild(context, launchOptions))
  registerCommand('flix.cmdBuildJar', handlers.cmdBuildJar(context, launchOptions))
  registerCommand('flix.cmdBuildPkg', handlers.cmdBuildPkg(context, launchOptions))
  registerCommand('flix.cmdRunProject', handlers.cmdRunProject(context, launchOptions))
  registerCommand('flix.cmdBenchmark', handlers.cmdBenchmark(context, launchOptions))
  registerCommand('flix.cmdTests', handlers.cmdTests(context, launchOptions))
  //registerCommand('flix.cmdTestWithFilter', handlers.cmdTestWithFilter(context, launchOptions))
  //registerCommand('flix.cmdRepl', handlers.cmdRepl(context, launchOptions))
  
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

  // watch for changes on the file system (delete, create .fpkg files)
  pkgWatcher = vscode.workspace.createFileSystemWatcher(FPKG_GLOB_PATTERN)
  pkgWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    client.sendNotification(jobs.Request.apiRemPkg, { uri })
  })
  pkgWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    client.sendNotification(jobs.Request.apiAddPkg, { uri })
  })
  
  // watch for changes on the file system (delete, create .jar files)
  pkgWatcher = vscode.workspace.createFileSystemWatcher(JAR_GLOB_PATTERN)
  pkgWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    client.sendNotification(jobs.Request.apiRemJar, { uri })
  })
  pkgWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    client.sendNotification(jobs.Request.apiAddJar, { uri })
  })

  // watch for changes to the flix.toml file
  tomlWatcher = vscode.workspace.createFileSystemWatcher(FLIX_TOML_GLOB_PATTERN)
  tomlWatcher.onDidChange(() => {
    const doReload = vscode.window.showInformationMessage(
        "The flix.toml file has changed. Do you want to restart the compiler?", "Yes", "No")
    doReload.then((res) => {
        if (res == "Yes") {
            makeHandleRestartClient(context, launchOptions)()
        }
    });
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
  
  // show default output channel without changing focus
  outputChannel.show(true)

  const globalStoragePath = context.globalStorageUri.fsPath;
  const workspaceFolders = _.map(_.flow(_.get('uri'), _.get('fsPath')), vscode.workspace.workspaceFolders)
  const workspaceFiles: [string] = _.map(vsCodeUriToUriString, (await vscode.workspace.findFiles(FLIX_GLOB_PATTERN)))
  const workspacePkgs: [string] = _.map(vsCodeUriToUriString, (await vscode.workspace.findFiles(FPKG_GLOB_PATTERN)))
  const workspaceJars: [string] = _.map(vsCodeUriToUriString, (await vscode.workspace.findFiles(JAR_GLOB_PATTERN)))

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
    globalStoragePath,
    workspaceFiles,
    workspacePkgs,
    workspaceJars,
    userConfiguration: getUserConfiguration()
  })

  // Handle when server has answered back after getting the notification above
  client.onNotification(jobs.Request.internalReady, function handler () {
    // waits for server to answer back after having started successfully
    eventEmitter.emit(jobs.Request.internalReady)
    
    // start the Flix runner (but only after the Flix LSP instance has started.)
    handlers.createSharedRepl(context, launchOptions)
  })

  client.onNotification(jobs.Request.internalFinishedJob, function handler () {
    // only one job runs at once, so currently not trying to distinguish
    eventEmitter.emit(jobs.Request.internalFinishedJob)
  })

  client.onNotification(jobs.Request.internalDiagnostics, handlePrintDiagnostics)

  client.onNotification(jobs.Request.internalRestart, makeHandleRestartClient(context))

  client.onNotification(jobs.Request.internalMessage, vscode.window.showInformationMessage)

  client.onNotification(jobs.Request.internalError, vscode.window.showErrorMessage)

  client.onNotification(jobs.Request.lspCodeAction, handleCodeAction)

}

export function deactivate (): Thenable<void> | undefined {
  flixWatcher && flixWatcher.dispose()
  pkgWatcher && pkgWatcher.dispose()
  tomlWatcher && tomlWatcher.dispose()
  outputChannel && outputChannel.dispose()
  return client ? client.stop() : undefined
}
