import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

import * as jobs from './engine/jobs'

import ensureFlixExists from './util/ensureFlixExists'
import createLanguageClient from './util/createLanguageClient'
import showStartupProgress from './util/showStartupProgress'

import eventEmitter from './services/eventEmitter'
import initialiseState from './services/state'
import { FlixLspTerminal } from './services/flixLspTerminal'

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

let hasReceivedReadyMessage = false

let flixWatcher: vscode.FileSystemWatcher

let pkgWatcher: vscode.FileSystemWatcher

let jarWatcher: vscode.FileSystemWatcher

let tomlWatcher: vscode.FileSystemWatcher

let knownFlixFiles: Set<string> = new Set()
let knownPkgFiles: Set<string> = new Set()
let knownJarFiles: Set<string> = new Set()
let reconcileTimer: ReturnType<typeof setTimeout> | undefined

const extensionObject = vscode.extensions.getExtension('flix.flix')

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

let outputChannel: vscode.OutputChannel

let flixLspTerminal: FlixLspTerminal

/**
 * Convert URI to file scheme URI shared by e.g. TextDocument's URI.
 *
 * @param uri {vscode.Uri}
 */
function vsCodeUriToUriString(uri: vscode.Uri) {
  return vscode.Uri.file(uri.path).toString(false)
}

/**
 * Re-scans the filesystem and diffs against known files.
 * Sends add/rem notifications for any discrepancies.
 *
 * This handles folder deletion/creation where onDidDelete/onDidCreate
 * fires for the folder but not for individual files inside it.
 */
async function reconcileFiles() {
  if (!isProjectMode()) return

  const [currentFlix, currentPkgs, currentJars] = await Promise.all([
    vscode.workspace.findFiles(getFlixGlobPattern()).then(uris => new Set(uris.map(vsCodeUriToUriString))),
    vscode.workspace.findFiles(getFpkgGlobPattern()).then(uris => new Set(uris.map(vsCodeUriToUriString))),
    vscode.workspace.findFiles(getJarGlobPattern()).then(uris => new Set(uris.map(vsCodeUriToUriString))),
  ])

  for (const uri of knownFlixFiles) {
    if (!currentFlix.has(uri)) {
      client.sendNotification(jobs.Request.apiRemUri, { uri })
    }
  }
  for (const uri of currentFlix) {
    if (!knownFlixFiles.has(uri)) {
      client.sendNotification(jobs.Request.apiAddUri, { uri })
    }
  }

  for (const uri of knownPkgFiles) {
    if (!currentPkgs.has(uri)) {
      client.sendNotification(jobs.Request.apiRemPkg, { uri })
    }
  }
  for (const uri of currentPkgs) {
    if (!knownPkgFiles.has(uri)) {
      client.sendNotification(jobs.Request.apiAddPkg, { uri })
    }
  }

  for (const uri of knownJarFiles) {
    if (!currentJars.has(uri)) {
      client.sendNotification(jobs.Request.apiRemJar, { uri })
    }
  }
  for (const uri of currentJars) {
    if (!knownJarFiles.has(uri)) {
      client.sendNotification(jobs.Request.apiAddJar, { uri })
    }
  }

  knownFlixFiles = currentFlix
  knownPkgFiles = currentPkgs
  knownJarFiles = currentJars
}

function scheduleReconciliation() {
  if (reconcileTimer !== undefined) {
    clearTimeout(reconcileTimer)
  }
  reconcileTimer = setTimeout(() => {
    reconcileTimer = undefined
    reconcileFiles()
  }, 300)
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

function stripAnsi(text: string): string {
  // Matches ANSI escape sequences: ESC[ followed by parameters and a command letter
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

function handlePrintDiagnostics({ status, result }) {
  if (getUserConfiguration().clearOutput.enabled) {
    flixLspTerminal.clear()
  }

  // Check if there are any errors
  const hasErrors = result.some(res => res.diagnostics.some(diag => diag.severity <= 2))

  if (!hasErrors) {
    // Only print success message after ready message has been shown
    // This avoids showing "Program compiles successfully" before "Flix Ready"
    if (hasReceivedReadyMessage) {
      flixLspTerminal.writeLine('\x1b[32m' + USER_MESSAGE.COMPILE_SUCCESS() + '\x1b[0m')
    }
  } else {
    for (const res of result) {
      for (const diag of res.diagnostics) {
        if (diag.severity <= 2) {
          flixLspTerminal.writeLine(diag.fullMessage)
        }
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

    flixWatcher = vscode.workspace.createFileSystemWatcher(getFlixGlobPattern())
    flixWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
      const uri = vsCodeUriToUriString(vsCodeUri)
      knownFlixFiles.delete(uri)
      client.sendNotification(jobs.Request.apiRemUri, { uri })
      scheduleReconciliation()
    })
    flixWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
      const uri = vsCodeUriToUriString(vsCodeUri)
      knownFlixFiles.add(uri)
      client.sendNotification(jobs.Request.apiAddUri, { uri })
      scheduleReconciliation()
    })

    pkgWatcher = vscode.workspace.createFileSystemWatcher(getFpkgGlobPattern())
    pkgWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
      const uri = vsCodeUriToUriString(vsCodeUri)
      knownPkgFiles.delete(uri)
      client.sendNotification(jobs.Request.apiRemPkg, { uri })
      scheduleReconciliation()
    })
    pkgWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
      const uri = vsCodeUriToUriString(vsCodeUri)
      knownPkgFiles.add(uri)
      client.sendNotification(jobs.Request.apiAddPkg, { uri })
      scheduleReconciliation()
    })

    jarWatcher = vscode.workspace.createFileSystemWatcher(getJarGlobPattern())
    jarWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
      const uri = vsCodeUriToUriString(vsCodeUri)
      knownJarFiles.delete(uri)
      client.sendNotification(jobs.Request.apiRemJar, { uri })
      scheduleReconciliation()
    })
    jarWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
      const uri = vsCodeUriToUriString(vsCodeUri)
      knownJarFiles.add(uri)
      client.sendNotification(jobs.Request.apiAddJar, { uri })
      scheduleReconciliation()
    })

    tomlWatcher = vscode.workspace.createFileSystemWatcher(getFlixTomlGlobPattern())
    tomlWatcher.onDidChange(() => {
      const { msg, option1, option2 } = USER_MESSAGE.ASK_RELOAD_TOML()
      const doReload = vscode.window.showInformationMessage(msg, option1, option2)
      doReload.then(res => {
        if (res === 'Yes') {
          makeHandleRestartClient(context, launchOptions)()
        }
      })
    })

    // Watch for folder-level deletions/creations (e.g. deleting src/) that
    // the file-specific watchers above don't catch.
    vscode.workspace.onDidDeleteFiles(() => scheduleReconciliation())
    vscode.workspace.onDidCreateFiles(() => scheduleReconciliation())
  } else {
    // In single-file mode there is no workspace folder to watch.
    // Instead, track document open/close to add/remove .flix files from the compiler.
    // Content changes are already handled by the LSP TextDocumentSync mechanism.
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (doc.uri.path.endsWith('.flix')) {
        client.sendNotification(jobs.Request.apiAddUri, { uri: vsCodeUriToUriString(doc.uri) })
      }
    })
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.uri.path.endsWith('.flix')) {
        client.sendNotification(jobs.Request.apiRemUri, { uri: vsCodeUriToUriString(doc.uri) })
      }
    })
  }

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
  // Reset ready message flag for new session
  hasReceivedReadyMessage = false

  // clear listeners from previous sessions
  eventEmitter.removeAllListeners()

  // clear outputs
  outputChannel.clear()

  const globalStoragePath = context.globalStorageUri.fsPath
  const workspaceFolders = vscode.workspace.workspaceFolders?.map(ws => ws.uri.fsPath)

  // In project mode, discover files via workspace glob patterns.
  // In single-file mode, use the currently open .flix documents instead.
  let workspaceFiles: string[]
  let workspacePkgs: string[]
  let workspaceJars: string[]
  if (isProjectMode()) {
    workspaceFiles = (await vscode.workspace.findFiles(getFlixGlobPattern())).map(vsCodeUriToUriString)
    workspacePkgs = (await vscode.workspace.findFiles(getFpkgGlobPattern())).map(vsCodeUriToUriString)
    workspaceJars = (await vscode.workspace.findFiles(getJarGlobPattern())).map(vsCodeUriToUriString)
    knownFlixFiles = new Set(workspaceFiles)
    knownPkgFiles = new Set(workspacePkgs)
    knownJarFiles = new Set(workspaceJars)
  } else {
    workspaceFiles = vscode.workspace.textDocuments
      .filter(doc => doc.uri.path.endsWith('.flix'))
      .map(doc => vsCodeUriToUriString(doc.uri))
    workspacePkgs = []
    workspaceJars = []
    knownFlixFiles = new Set(workspaceFiles)
    knownPkgFiles = new Set()
    knownJarFiles = new Set()
  }

  // Wait until we're sure flix exists
  const flixFilename = await ensureFlixExists({
    globalStoragePath,
    workspaceFolders,
    shouldUpdateFlix: launchOptions.shouldUpdateFlix,
  })

  // A staged update was downloaded — a reload prompt is already showing.
  // Skip engine startup so the user doesn't see a stale "Starting Flix" progress.
  if (!flixFilename) {
    return
  }

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

  client.onNotification(jobs.Request.internalMessage, (message: string) => {
    hasReceivedReadyMessage = true
    flixLspTerminal.writeLine('\x1b[34m' + message + '\x1b[0m')
    vscode.window.showInformationMessage(message)
  })

  client.onNotification(jobs.Request.internalRecompiling, () => {
    if (hasReceivedReadyMessage) {
      flixLspTerminal.writeLine('\x1b[38;5;172m' + USER_MESSAGE.RECOMPILING() + '\x1b[0m')
    }
  })

  client.onNotification(jobs.Request.internalError, handleError)

  client.onNotification(jobs.Request.lspShowAst, handleShowAst)
}

export function deactivate(): Thenable<void> | undefined {
  flixWatcher && flixWatcher.dispose()
  pkgWatcher && pkgWatcher.dispose()
  jarWatcher && jarWatcher.dispose()
  tomlWatcher && tomlWatcher.dispose()
  outputChannel && outputChannel.dispose()
  if (reconcileTimer !== undefined) {
    clearTimeout(reconcileTimer)
  }
  return client ? client.stop() : undefined
}
