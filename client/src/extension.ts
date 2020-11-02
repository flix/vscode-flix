import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient'

import * as jobs from './engine/jobs'

import ensureFlixExists from './util/ensureFlixExists'
import createLanguageClient from './util/createLanguageClient'
import showStartupProgress from './util/showStartupProgress'

import eventEmitter from './services/eventEmitter'
import initialiseState from './services/state'

import * as handlers from './handlers'

const _ = require('lodash/fp')

interface LaunchOptions {
  shouldUpdateFlix: boolean
}

const defaultLaunchOptions: LaunchOptions = {
  shouldUpdateFlix: false
}

let client: LanguageClient

let flixWatcher: vscode.FileSystemWatcher

const extensionObject = vscode.extensions.getExtension('flix.flix')

const FLIX_GLOB_PATTERN = '**/*.flix'

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
    await deactivate()
    await activate(context, launchOptions)
  }
}

function handlePrintDiagnostics ({ status, result }) {
  if (status === 'success') {
    if (diagnosticsErrors) {
      diagnosticsOutputChannel.clear()
      diagnosticsOutputChannel.appendLine(`${String.fromCodePoint(0x2705)} No errors ${String.fromCodePoint(0x2705)}`)
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
  }
}

export async function activate (context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  // activate state
  initialiseState(context)

  // create output channels
  outputChannel = vscode.window.createOutputChannel('Flix Extension')
  diagnosticsOutputChannel = vscode.window.createOutputChannel('Flix Errors')

  // show default output channel without changing focus
  outputChannel.show(true)

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

  registerCommand('flix.cmdRunMain', handlers.makeHandleRunJobWithProgress(client, outputChannel, jobs.Request.cmdRunMain, 'Running..'))
  registerCommand('flix.cmdRunAllTests', handlers.makeHandleRunJobWithProgress(client, outputChannel, jobs.Request.cmdRunTests, 'Running tests..'))

  // NOTE: Currently commented out as it is being worked on.
  // registerCommand('flix.cmdRunBenchmarks', handlers.makeHandleRunJob(client, jobs.Request.cmdRunBenchmarks))

  // NOTE: Add this to the root package.json under `contributes.commands`

  // {
  //   "command": "flix.cmdRunBenchmarks",
  //   "title": "Flix: Run Benchmarks"
  // },

  // Register packager commands for commands palette
  // NOTE: Currently commented out as they are being worked on.
  // NOTE: To get it back, add these to root package.json under `contributes.commands`

  // {
  //   "command": "flix.pkgBenchmark",
  //   "title": "Flix: Package Benchmark"
  // },
  // {
  //   "command": "flix.pkgBuild",
  //   "title": "Flix: Package Build"
  // },
  // {
  //   "command": "flix.pkgBuildDoc",
  //   "title": "Flix: Package Build Doc"
  // },
  // {
  //   "command": "flix.pkgBuildJar",
  //   "title": "Flix: Package Build Jar"
  // },
  // {
  //   "command": "flix.pkgBuildPkg",
  //   "title": "Flix: Package Build Package"
  // },
  // {
  //   "command": "flix.pkgInit",
  //   "title": "Flix: Package Init"
  // },
  // {
  //   "command": "flix.pkgTest",
  //   "title": "Flix: Package Test"
  // }

  // registerCommand('flix.pkgBenchmark', handlers.makeHandleRunJob(client, jobs.Request.pkgBenchmark))
  // registerCommand('flix.pkgBuild', handlers.makeHandleRunJob(client, jobs.Request.pkgBuild))
  // registerCommand('flix.pkgBuildDoc', handlers.makeHandleRunJob(client, jobs.Request.pkgBuildDoc))
  // registerCommand('flix.pkgBuildJar', handlers.makeHandleRunJob(client, jobs.Request.pkgBuildJar))
  // registerCommand('flix.pkgBuildPkg', handlers.makeHandleRunJob(client, jobs.Request.pkgBuildPkg))
  // registerCommand('flix.pkgInit', handlers.makeHandleRunJob(client, jobs.Request.pkgInit))
  // registerCommand('flix.pkgTest', handlers.makeHandleRunJob(client, jobs.Request.pkgTest))

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

  const globalStoragePath = context.globalStoragePath
  const workspaceFolders = _.map(_.flow(_.get('uri'), _.get('fsPath')), vscode.workspace.workspaceFolders)
  const workspaceFiles: [string] = _.map(vsCodeUriToUriString, (await vscode.workspace.findFiles(FLIX_GLOB_PATTERN)))

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
    workspaceFiles
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
  if (!client) {
    return undefined
  }
  flixWatcher.dispose()
  outputChannel.dispose()
  diagnosticsOutputChannel.dispose()
  return client.stop()
}
