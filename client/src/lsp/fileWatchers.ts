import * as vscode from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'
import * as jobs from '../protocol/requests'
import {
  isProjectMode,
  getFlixGlobPattern,
  getFpkgGlobPattern,
  getJarGlobPattern,
  getFlixTomlGlobPattern,
} from '../extension'
import { USER_MESSAGE } from '../ui/messages'

let flixWatcher: vscode.FileSystemWatcher
let pkgWatcher: vscode.FileSystemWatcher
let jarWatcher: vscode.FileSystemWatcher
let tomlWatcher: vscode.FileSystemWatcher

let knownFlixFiles: Set<string> = new Set()
let knownPkgFiles: Set<string> = new Set()
let knownJarFiles: Set<string> = new Set()
let reconcileTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Convert URI to file scheme URI shared by e.g. TextDocument's URI.
 *
 * @param uri {vscode.Uri}
 */
export function vsCodeUriToUriString(uri: vscode.Uri) {
  return vscode.Uri.file(uri.path).toString(false)
}

/**
 * Re-scans the filesystem and diffs against known files.
 * Sends add/rem notifications for any discrepancies.
 *
 * This handles folder deletion/creation where onDidDelete/onDidCreate
 * fires for the folder but not for individual files inside it.
 */
async function reconcileFiles(client: LanguageClient) {
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

function scheduleReconciliation(client: LanguageClient) {
  if (reconcileTimer !== undefined) {
    clearTimeout(reconcileTimer)
  }
  reconcileTimer = setTimeout(() => {
    reconcileTimer = undefined
    reconcileFiles(client)
  }, 300)
}

/**
 * Set up file system watchers for project mode.
 * Watches .flix, .fpkg, .jar, and flix.toml files.
 */
export function setupProjectWatchers(client: LanguageClient, onRestartClient: () => void) {
  flixWatcher = vscode.workspace.createFileSystemWatcher(getFlixGlobPattern())
  flixWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    knownFlixFiles.delete(uri)
    client.sendNotification(jobs.Request.apiRemUri, { uri })
    scheduleReconciliation(client)
  })
  flixWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    knownFlixFiles.add(uri)
    client.sendNotification(jobs.Request.apiAddUri, { uri })
    scheduleReconciliation(client)
  })

  pkgWatcher = vscode.workspace.createFileSystemWatcher(getFpkgGlobPattern())
  pkgWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    knownPkgFiles.delete(uri)
    client.sendNotification(jobs.Request.apiRemPkg, { uri })
    scheduleReconciliation(client)
  })
  pkgWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    knownPkgFiles.add(uri)
    client.sendNotification(jobs.Request.apiAddPkg, { uri })
    scheduleReconciliation(client)
  })

  jarWatcher = vscode.workspace.createFileSystemWatcher(getJarGlobPattern())
  jarWatcher.onDidDelete((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    knownJarFiles.delete(uri)
    client.sendNotification(jobs.Request.apiRemJar, { uri })
    scheduleReconciliation(client)
  })
  jarWatcher.onDidCreate((vsCodeUri: vscode.Uri) => {
    const uri = vsCodeUriToUriString(vsCodeUri)
    knownJarFiles.add(uri)
    client.sendNotification(jobs.Request.apiAddJar, { uri })
    scheduleReconciliation(client)
  })

  tomlWatcher = vscode.workspace.createFileSystemWatcher(getFlixTomlGlobPattern())
  tomlWatcher.onDidChange(() => {
    const { msg, option1, option2 } = USER_MESSAGE.ASK_RELOAD_TOML()
    const doReload = vscode.window.showInformationMessage(msg, option1, option2)
    doReload.then(res => {
      if (res === 'Yes') {
        onRestartClient()
      }
    })
  })

  // Watch for folder-level deletions/creations (e.g. deleting src/) that
  // the file-specific watchers above don't catch.
  vscode.workspace.onDidDeleteFiles(() => scheduleReconciliation(client))
  vscode.workspace.onDidCreateFiles(() => scheduleReconciliation(client))
}

/**
 * Set up document tracking for single-file mode.
 * Tracks document open/close to add/remove .flix files from the compiler.
 * Content changes are already handled by the LSP TextDocumentSync mechanism.
 */
export function setupSingleFileTracking(client: LanguageClient) {
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

/**
 * Discover all workspace files and update the known file sets.
 * In project mode, uses workspace glob patterns.
 * In single-file mode, uses currently open .flix documents.
 */
export async function discoverWorkspaceFiles(): Promise<{
  workspaceFiles: string[]
  workspacePkgs: string[]
  workspaceJars: string[]
}> {
  if (isProjectMode()) {
    const workspaceFiles = (await vscode.workspace.findFiles(getFlixGlobPattern())).map(vsCodeUriToUriString)
    const workspacePkgs = (await vscode.workspace.findFiles(getFpkgGlobPattern())).map(vsCodeUriToUriString)
    const workspaceJars = (await vscode.workspace.findFiles(getJarGlobPattern())).map(vsCodeUriToUriString)
    knownFlixFiles = new Set(workspaceFiles)
    knownPkgFiles = new Set(workspacePkgs)
    knownJarFiles = new Set(workspaceJars)
    return { workspaceFiles, workspacePkgs, workspaceJars }
  } else {
    const workspaceFiles = vscode.workspace.textDocuments
      .filter(doc => doc.uri.path.endsWith('.flix'))
      .map(doc => vsCodeUriToUriString(doc.uri))
    knownFlixFiles = new Set(workspaceFiles)
    knownPkgFiles = new Set()
    knownJarFiles = new Set()
    return { workspaceFiles, workspacePkgs: [], workspaceJars: [] }
  }
}

/**
 * Dispose all file system watchers and clear the reconciliation timer.
 */
export function disposeWatchers() {
  flixWatcher && flixWatcher.dispose()
  pkgWatcher && pkgWatcher.dispose()
  jarWatcher && jarWatcher.dispose()
  tomlWatcher && tomlWatcher.dispose()
  if (reconcileTimer !== undefined) {
    clearTimeout(reconcileTimer)
  }
}
