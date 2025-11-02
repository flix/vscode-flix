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
import { USER_MESSAGE } from './util/userMessages'
import { StatusCode } from './util/statusCodes'

export interface LaunchOptions {
  shouldUpdateFlix: boolean
}

export const defaultLaunchOptions: LaunchOptions = {
  shouldUpdateFlix: false,
}

let client: LanguageClient

let flixWatcher: vscode.FileSystemWatcher

let pkgWatcher: vscode.FileSystemWatcher

let tomlWatcher: vscode.FileSystemWatcher

const extensionObject = vscode.extensions.getExtension('flix.flix')

export const FLIX_GLOB_PATTERN = new vscode.RelativePattern(
  vscode.workspace.workspaceFolders?.[0],
  '{*.flix,src/**/*.flix,test/**/*.flix}',
)

export const FPKG_GLOB_PATTERN = new vscode.RelativePattern(vscode.workspace.workspaceFolders?.[0], 'lib/**/*.fpkg')
export const JAR_GLOB_PATTERN = new vscode.RelativePattern(vscode.workspace.workspaceFolders?.[0], 'lib/**/*.jar')
export const FLIX_TOML_GLOB_PATTERN = new vscode.RelativePattern(vscode.workspace.workspaceFolders?.[0], 'flix.toml')

let outputChannel: vscode.OutputChannel

/**
 * Convert URI to file scheme URI shared by e.g. TextDocument's URI.
 *
 * @param uri {vscode.Uri}
 */
function vsCodeUriToUriString(uri: vscode.Uri) {
  return vscode.Uri.file(uri.path).toString(false)
}

function makeHandleRestartClient(context: vscode.ExtensionContext, launchOptions?: LaunchOptions) {
  return async function handleRestartClient() {
    callResolversAndEmptyList()
    await startSession(context, launchOptions, client)
  }
}

async function handleShowAst({ status, result }) {
  if (status === StatusCode.Success) {
    const content: string = 'ASTs saved to: ' + result.path
    vscode.window.showInformationMessage(content)
  } else {
    const msg = USER_MESSAGE.CANT_SHOW_AST()
    vscode.window.showInformationMessage(msg)
  }
}

function getUserConfiguration() {
  return vscode.workspace.getConfiguration('flix')
}

function handlePrintDiagnostics({ status, result }) {
  if (getUserConfiguration().clearOutput.enabled) {
    outputChannel.clear()
  }

  for (const res of result) {
    for (const diag of res.diagnostics) {
      if (diag.severity <= 2) {
        outputChannel.appendLine(`${String.fromCodePoint(0x274c)} ${diag.fullMessage}`)
      }
    }
  }
}

interface Action {
  title: string
  command: {
    type: 'openFile'
    path: string
  }
}
async function handleError({ message, actions }: { message: string; actions: Action[] }) {
  const selection = await vscode.window.showErrorMessage(message, ...actions.map(a => a.title))
  const action = actions.find(a => a.title === selection)
  if (action?.command?.type === 'openFile') {
    const uri = vscode.Uri.file(action.command.path)
    vscode.window.showTextDocument(uri)
  }
}

export async function activate(context: vscode.ExtensionContext, launchOptions: LaunchOptions = defaultLaunchOptions) {
  // activate state
  initialiseState(context)

  registerFlixReleaseDocumentProvider(context)

  // create output channels
  outputChannel = vscode.window.createOutputChannel('Flix Compiler')

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
  registerCommand('flix.format', handlers.format(client))

  // Register commands for testing

  // Returns a promise resolving when all jobs are completely finished and the server is idle.
  // While most other commands can be awaited directly, this is useful for stuff like file creation, which indirectely triggers an asynchronous job.
  registerCommand('flix.allJobsFinished', handlers.allJobsFinished(client, eventEmitter))

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
    const { msg, option1, option2 } = USER_MESSAGE.ASK_RELOAD_TOML()
    const doReload = vscode.window.showInformationMessage(msg, option1, option2)
    doReload.then(res => {
      if (res === 'Yes') {
        makeHandleRestartClient(context, launchOptions)()
      }
    })
  })

  vscode.window.onDidChangeActiveTextEditor(handlers.handleChangeEditor)
  vscode.workspace.onDidChangeConfiguration(() => {
    client.sendNotification(jobs.Request.internalReplaceConfiguration, getUserConfiguration())
  })

  await startSession(context, launchOptions, client)
}

async function startSession(
  context: vscode.ExtensionContext,
  launchOptions: LaunchOptions = defaultLaunchOptions,
  client: LanguageClient,
) {
  // clear listeners from previous sessions
  eventEmitter.removeAllListeners()

  // clear outputs
  outputChannel.clear()

  // show default output channel without changing focus
  outputChannel.show(true)

  const globalStoragePath = context.globalStorageUri.fsPath
  const workspaceFolders = vscode.workspace.workspaceFolders?.map(ws => ws.uri.fsPath)
  const workspaceFiles = (await vscode.workspace.findFiles(FLIX_GLOB_PATTERN)).map(vsCodeUriToUriString)
  const workspacePkgs = (await vscode.workspace.findFiles(FPKG_GLOB_PATTERN)).map(vsCodeUriToUriString)
  const workspaceJars = (await vscode.workspace.findFiles(JAR_GLOB_PATTERN)).map(vsCodeUriToUriString)

  // Wait until we're sure flix exists
  const flixFilename = await ensureFlixExists({
    globalStoragePath,
    workspaceFolders,
    shouldUpdateFlix: launchOptions.shouldUpdateFlix,
  })

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
    userConfiguration: getUserConfiguration(),
  })

  // Handle when server has answered back after getting the notification above
  client.onNotification(jobs.Request.internalReady, () => {
    // waits for server to answer back after having started successfully
    eventEmitter.emit(jobs.Request.internalReady)

    // start the Flix runner (but only after the Flix LSP instance has started.)
    handlers.initSharedRepl(context, launchOptions)
  })

  client.onNotification(jobs.Request.internalFinishedJob, () => {
    // only one job runs at once, so currently not trying to distinguish
    eventEmitter.emit(jobs.Request.internalFinishedJob)
  })

  client.onNotification(jobs.Request.internalFinishedAllJobs, () =>
    eventEmitter.emit(jobs.Request.internalFinishedAllJobs),
  )

  client.onNotification(jobs.Request.internalDiagnostics, handlePrintDiagnostics)

  client.onNotification(jobs.Request.internalMessage, vscode.window.showInformationMessage)

  client.onNotification(jobs.Request.internalError, handleError)

  client.onNotification(jobs.Request.lspShowAst, handleShowAst)
}

export function deactivate(): Thenable<void> | undefined {
  flixWatcher && flixWatcher.dispose()
  pkgWatcher && pkgWatcher.dispose()
  tomlWatcher && tomlWatcher.dispose()
  outputChannel && outputChannel.dispose()
  return client ? client.stop() : undefined
}
