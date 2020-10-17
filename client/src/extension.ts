import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient'
import { EventEmitter } from 'events'

import * as jobs from './engine/jobs'

import ensureFlixExists from './util/ensureFlixExists'
import createLanguageClient from './util/createLanguageClient'

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

const readyEventEmitter = new EventEmitter()

let outputChannel: vscode.OutputChannel

let diagnosticsOutputChannel: vscode.OutputChannel

// flag to keep track of whether errors were present last time we ran diagnostics
let diagnosticsErrors = false

function showStartupProgress () {
  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Starting Flix',
    cancellable: false
  }, function (_progress) {
    return new Promise(function resolver (resolve, reject) {
      const tookTooLong = setTimeout(function tookTooLongHandler () {
        vscode.window.showErrorMessage('Timed out trying to start.')
        reject()
      }, 10 * 1000)

      readyEventEmitter.on(jobs.Request.internalReady, function readyHandler () {
        clearTimeout(tookTooLong)
        resolve()
      })
    })
  })
}

/**
 * Convert URI to file scheme URI shared by e.g. TextDocument's URI.
 *
 * @param uri {vscode.Uri}
 */
function vsCodeUriToUriString (uri: vscode.Uri) {
  return vscode.Uri.file(uri.path).toString(false)
}

function restartClient (context: vscode.ExtensionContext, launchOptions?: LaunchOptions) {
  return async function () {
    await deactivate()
    await activate(context, launchOptions)
  }
}

function makeHandleRunCommand (request: jobs.Request, title: string, timeout: number = 180) {
  return function handler () {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    }, function (_progress) {
      return new Promise(function resolver (resolve, reject) {
        client.sendNotification(request)
  
        const tookTooLong = setTimeout(function tookTooLongHandler () {
          vscode.window.showErrorMessage(`Command timed out after ${timeout} seconds`)
          reject()
        }, timeout * 1000)
  
        readyEventEmitter.on(jobs.Request.internalFinishedJob, function readyHandler () {
          clearTimeout(tookTooLong)
          outputChannel.show()
          resolve()
        })

        readyEventEmitter.on(jobs.Request.internalRestart, function readyHandler () {
          // stop the run command if we restart for some reason
          clearTimeout(tookTooLong)
          resolve()
        })
      })
    })
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
  outputChannel = vscode.window.createOutputChannel('Flix Extension')
  diagnosticsOutputChannel = vscode.window.createOutputChannel('Flix Errors')
  
  client = createLanguageClient({ context, outputChannel })

  outputChannel.show(true)

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

  // Register available commands
  registerCommand('flix.internalRestart', restartClient(context, { shouldUpdateFlix: false }))
  registerCommand('flix.internalDownloadLatest', restartClient(context, { shouldUpdateFlix: true }))
  registerCommand('flix.cmdRunBenchmarks', () => {
    client.sendNotification(jobs.Request.cmdRunBenchmarks)
  })

  registerCommand('flix.cmdRunMain', makeHandleRunCommand(jobs.Request.cmdRunMain, 'Running..'))

  registerCommand('flix.cmdRunAllTests', makeHandleRunCommand(jobs.Request.cmdRunTests, 'Running tests..'))

  registerCommand('flix.pkgBenchmark', () => {
    client.sendNotification(jobs.Request.pkgBenchmark)
  })
  registerCommand('flix.pkgBuild', () => {
    client.sendNotification(jobs.Request.pkgBuild)
  })
  registerCommand('flix.pkgBuildDoc', () => {
    client.sendNotification(jobs.Request.pkgBuildDoc)
  })
  registerCommand('flix.pkgBuildJar', () => {
    client.sendNotification(jobs.Request.pkgBuildJar)
  })
  registerCommand('flix.pkgBuildPkg', () => {
    client.sendNotification(jobs.Request.pkgBuildPkg)
  })
  registerCommand('flix.pkgInit', () => {
    client.sendNotification(jobs.Request.pkgInit)
  })
  registerCommand('flix.pkgTest', () => {
    client.sendNotification(jobs.Request.pkgTest)
  })

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
  
  client.sendNotification(jobs.Request.internalReady, {
    flixFilename,
    workspaceFolders,
    extensionPath: extensionObject.extensionPath || context.extensionPath,
    extensionVersion: extensionObject.packageJSON.version,
    globalStoragePath: context.globalStoragePath,
    workspaceFiles
  })

  showStartupProgress()

  client.onNotification(jobs.Request.internalReady, function handler () {
    // waits for server to answer back after having started successfully 
    readyEventEmitter.emit(jobs.Request.internalReady)
  })

  client.onNotification(jobs.Request.internalFinishedJob, function handler () {
    // only one job runs at once, so currently not trying to distinguish
    readyEventEmitter.emit(jobs.Request.internalFinishedJob)
  })

  client.onNotification(jobs.Request.internalDiagnostics, handlePrintDiagnostics)

  client.onNotification(jobs.Request.internalRestart, restartClient(context))

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
